import { parseWardQRCode } from '../src/lib/qr/parser';
import { WARDS_SEED_DATA } from '../src/data/wardsSeed';
import { sanitizeCsvCell, generateCsv } from '../src/lib/csv/export';
import {
  getAllWards,
  getWardByNumber,
  recordArrival,
  voidArrivalBatch,
  updateWardAdmin,
  getDashboardSummary,
  getAuditLogs,
} from '../src/lib/server/dataStore';

async function runVerification() {
  console.log('====================================================');
  console.log('BHASHYAM RAMAKRISHNA EVENT SYSTEM - FULL VERIFICATION');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   Detail: ${detail}`);
      process.exitCode = 1;
    }
  }

  // TEST 1: QR Parser - All 76 Printed URLs
  console.log('--- TEST GROUP 1: QR Parser & URL Validation ---');
  let all76Passed = true;
  for (let i = 1; i <= 76; i++) {
    const url = `https://event.bhashyamramakrishna.in/ward${i}`;
    const result = parseWardQRCode(url);
    if (!result.valid || result.wardNumber !== i) {
      all76Passed = false;
      break;
    }
  }
  assert(all76Passed, 'All 76 printed QR URLs resolve to exact ward numbers (1–76)');

  // TEST 2: QR Parser - Rejections
  const invalidUrls = [
    { url: 'https://event.bhashyamramakrishna.in/ward0', desc: 'Ward 0 rejected' },
    { url: 'https://event.bhashyamramakrishna.in/ward77', desc: 'Ward 77 rejected' },
    { url: 'https://event.bhashyamramakrishna.in/ward999', desc: 'Ward 999 rejected' },
    { url: 'https://event.bhashyamramakrishna.in/invalid-page', desc: 'Non-ward path rejected' },
    { url: 'https://phishing-domain.com/ward1', desc: 'Unrelated foreign domain rejected' },
    { url: 'random-text-not-a-url', desc: 'Malformed input rejected' },
    { url: '', desc: 'Empty input rejected' },
  ];

  for (const item of invalidUrls) {
    const res = parseWardQRCode(item.url);
    assert(!res.valid, `Security Check: ${item.desc}`);
  }

  // TEST 3: 76-Ward Dataset Completeness
  console.log('\n--- TEST GROUP 2: Ward Dataset Integrity ---');
  assert(WARDS_SEED_DATA.length === 76, 'Dataset contains exactly 76 wards');

  const wardNumbers = WARDS_SEED_DATA.map((w) => w.ward_number);
  const uniqueNumbers = new Set(wardNumbers);
  assert(uniqueNumbers.size === 76, 'All wards 1–76 appear uniquely without duplicates');

  const tdpCount = WARDS_SEED_DATA.filter((w) => w.party === 'TDP').length;
  const jspCount = WARDS_SEED_DATA.filter((w) => w.party === 'JSP').length;
  const bjpCount = WARDS_SEED_DATA.filter((w) => w.party === 'BJP').length;

  assert(tdpCount === 57, `TDP ward count is 57 (got ${tdpCount})`);
  assert(jspCount === 15, `JSP ward count is 15 (got ${jspCount})`);
  assert(bjpCount === 4, `BJP ward count is 4 (got ${bjpCount})`);

  const totalAllowance = WARDS_SEED_DATA.reduce((acc, w) => acc + w.allowance, 0);
  assert(totalAllowance === 380, `Combined normal allowance is 380 (got ${totalAllowance})`);

  // TEST 4: Transactional Batch Arrivals (Batches of 2 and 3 = 5)
  console.log('\n--- TEST GROUP 3: Attendance Batch Processing ---');
  const testWardNumber = 42; // Ward 42: Tadisetty Venkata Uttej (TDP)
  const staffScanner = { id: 'staff-1', name: 'Scanner Operator', email: 'scanner@brk.in' };

  // Initial attendance check
  const wardBefore = await getWardByNumber(testWardNumber);
  assert(wardBefore !== null && wardBefore.total_entered === 0, 'Ward 42 initially has 0 attendance');

  // First batch: 2 people
  const reqId1 = '00000000-0000-0000-0000-000000000001';
  const batch1Res = await recordArrival(
    {
      ward_id: testWardNumber,
      batch_size: 2,
      request_id: reqId1,
      expected_prior_count: 0,
      acknowledge_excess: false,
    },
    staffScanner
  );
  assert(batch1Res.success && batch1Res.cumulative_entered === 2, 'Batch 1 (2 people): cumulative attendance = 2');

  // Second batch: 3 people
  const reqId2 = '00000000-0000-0000-0000-000000000002';
  const batch2Res = await recordArrival(
    {
      ward_id: testWardNumber,
      batch_size: 3,
      request_id: reqId2,
      expected_prior_count: 2,
      acknowledge_excess: false,
    },
    staffScanner
  );
  assert(batch2Res.success && batch2Res.cumulative_entered === 5, 'Batch 2 (3 people): cumulative attendance = 5 (exact allowance)');

  // TEST 5: 6th Person triggers Excess Warning
  console.log('\n--- TEST GROUP 4: Excess Warning & Confirmation ---');
  const reqId3 = '00000000-0000-0000-0000-000000000003';
  const batch3Unconfirmed = await recordArrival(
    {
      ward_id: testWardNumber,
      batch_size: 1,
      request_id: reqId3,
      expected_prior_count: 5,
      acknowledge_excess: false, // NOT acknowledged
    },
    staffScanner
  );
  assert(
    !batch3Unconfirmed.success && batch3Unconfirmed.excess_warning_needed === true && batch3Unconfirmed.excess_by === 1,
    '6th person triggers excess warning (proposed 6, excess by 1) and does NOT save automatically'
  );

  // Submit anyway with acknowledgment
  const batch3Confirmed = await recordArrival(
    {
      ward_id: testWardNumber,
      batch_size: 1,
      request_id: reqId3,
      expected_prior_count: 5,
      acknowledge_excess: true, // ACKNOWLEDGED
    },
    staffScanner
  );
  assert(
    batch3Confirmed.success && batch3Confirmed.cumulative_entered === 6 && batch3Confirmed.excess_by === 1,
    'Confirmed excess entry saves successfully: cumulative attendance = 6'
  );

  // TEST 6: Double Submission / Idempotency
  console.log('\n--- TEST GROUP 5: Idempotency Protection ---');
  const duplicateRes = await recordArrival(
    {
      ward_id: testWardNumber,
      batch_size: 1,
      request_id: reqId3, // SAME request_id as batch 3
      expected_prior_count: 6,
      acknowledge_excess: true,
    },
    staffScanner
  );
  assert(
    duplicateRes.success && duplicateRes.duplicate_request === true && duplicateRes.cumulative_entered === 6,
    'Re-submitting with identical request ID is recognized as duplicate and does NOT increase count'
  );

  // TEST 7: Food Counts & Attendance Separation
  console.log('\n--- TEST GROUP 6: Food Planning Separation ---');
  const adminUser = { id: 'admin-1', name: 'Administrator' };

  // Update food counts on Ward 42
  await updateWardAdmin(
    testWardNumber,
    {
      expected_veg: 3,
      expected_non_veg: 2,
      food_confirmed: true,
    },
    adminUser
  );

  const wardAfterFood = await getWardByNumber(testWardNumber);
  assert(
    wardAfterFood?.total_entered === 6,
    'Updating food counts does not alter actual attendance (remains 6)'
  );
  assert(
    wardAfterFood?.expected_veg === 3 && wardAfterFood?.expected_non_veg === 2 && wardAfterFood?.food_confirmed === true,
    'Food counts saved accurately (Veg: 3, Non-veg: 2, Confirmed: true)'
  );

  // TEST 8: Void Batch & Audit Trail
  console.log('\n--- TEST GROUP 7: Voiding Mistakes & Audit Logs ---');
  if (batch3Confirmed.batch_id) {
    const voidRes = await voidArrivalBatch(
      batch3Confirmed.batch_id,
      'Mistaken 1-person duplicate scanned by gate staff',
      adminUser
    );
    assert(voidRes.success && voidRes.new_total === 5, 'Voiding batch 3 brings attendance back to 5');

    const wardAfterVoid = await getWardByNumber(testWardNumber);
    assert(wardAfterVoid?.total_entered === 5, 'Ward attendance recalculated to 5 excluding voided batch');
    assert(
      Boolean(wardAfterVoid?.recent_batches?.some((b) => b.id === batch3Confirmed.batch_id && b.is_voided)),
      'Voided batch record is preserved in history with void reason'
    );
  }

  // Audit logs check
  const auditLogs = await getAuditLogs();
  assert(auditLogs.length > 0, `Audit log recorded ${auditLogs.length} entries`);

  // TEST 9: CSV Formula Injection Protection
  console.log('\n--- TEST GROUP 8: CSV Formula Injection Protection ---');
  const dangerousValues = [
    '=1+2',
    '-5+10',
    '+CMD|',
    '@SUM(A1:A10)',
    '\tcalc.exe',
    '\rshutdown',
    'Normal Name',
  ];

  const sanitized = dangerousValues.map(sanitizeCsvCell);
  assert(sanitized[0] === "'=1+2", "Sanitized formula '=1+2' to ''=1+2'");
  assert(sanitized[1] === "'-5+10", "Sanitized formula '-5+10' to ''-5+10'");
  assert(sanitized[2] === "'+CMD|", "Sanitized formula '+CMD|' to ''+CMD|'");
  assert(sanitized[3] === "'@SUM(A1:A10)", "Sanitized formula '@SUM(A1:A10)' to ''@SUM(A1:A10)'");
  assert(sanitized[6] === 'Normal Name', 'Safe value unchanged');

  // TEST 10: Dashboard Summary Aggregation
  console.log('\n--- TEST GROUP 9: Dashboard Summary Metrics ---');
  const summary = await getDashboardSummary();
  assert(summary.normal_total_allowance === 380, 'Dashboard normal total allowance = 380');
  assert(summary.total_entered === 5, `Dashboard total entered reflects valid non-voided count (${summary.total_entered})`);
  assert(summary.wards_with_arrivals === 1, 'Dashboard counts 1 ward with arrivals');
  assert(summary.wards_without_arrivals === 75, 'Dashboard counts 75 wards pending');

  console.log('\n====================================================');
  console.log(`VERIFICATION COMPLETE: ${passedTests} / ${totalTests} TESTS PASSED!`);
  console.log('====================================================\n');
}

runVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
