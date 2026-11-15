const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').forEach(l => {
  const [k, ...v] = l.split('=');
  if (k && v) process.env[k.trim()] = v.join('=').trim();
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const userPhones = {
  1: '9397605656',
  3: '9182187619',
  4: '9070279999',
  5: '9700025717',
  6: '9550224449',
  9: '6301356234',
  10: '9063901236',
  11: '9849378674',
  13: '9581014515',
  14: '9866300002',
  17: '9246452233',
  18: '9705396091',
  19: '9000443168',
  20: '8331830902',
  21: '9704039255',
  23: '9848746159',
  24: '8500006458',
  25: '8328483469',
  26: '9440257785',
  27: '9849414124',
  28: '9866749506',
  29: '8019333786',
  30: '9703505539',
  31: '6302552079',
  32: '9440196917',
  33: '9848575768',
  34: '9966388138',
  35: '9666666333',
  37: '9676692999',
  40: '8008855999',
  41: '9866987505',
  42: '7702020606',
  43: '9676160267',
  44: '9848506461',
  45: '9885164343',
  46: '9395101393',
  47: '9398428048',
  48: '9988133999',
  49: '9701346880',
  50: '9000812131',
  51: '9494218180',
  52: '9052444636',
  54: '9985932980',
  55: '9440474495',
  56: '9848955779',
  57: '9440179069',
  59: '9849703588',
  60: '9885139815',
  61: '8686423216',
  62: '7306999999',
  63: '9908439199',
  64: '9052910549',
  65: '9959731888',
  66: '9948909666',
  67: '7989236370',
  68: '7013876360',
  69: '9603805157',
  70: '6281240067',
  71: '9951599003',
  72: '9490364859',
  73: '9849046346',
  74: '9299558641',
  75: '9700819616',
  76: '8885231155'
};

async function updateAll() {
  console.log('1. Clearing phone for ward 2...');
  const { error: err2 } = await supabase.from('wards').update({ phone: null }).eq('ward_number', 2);
  if (err2) console.error('Error clearing ward 2:', err2);
  else console.log('Successfully cleared ward 2 phone');

  console.log('2. Clearing phones for other non-winning wards...');
  const nonWinners = [7, 8, 12, 15, 16, 22, 36, 38, 39, 53, 58];
  for (const nw of nonWinners) {
    await supabase.from('wards').update({ phone: null }).eq('ward_number', nw);
  }

  console.log('3. Updating 64 winning wards with phones...');
  let count = 0;
  for (const [wStr, phone] of Object.entries(userPhones)) {
    const wardNum = parseInt(wStr, 10);
    const { error } = await supabase.from('wards').update({ phone }).eq('ward_number', wardNum);
    if (error) console.error(`Error ward ${wardNum}:`, error);
    else count++;
  }
  console.log(`Successfully updated ${count} winning wards in Supabase.`);
}

updateAll();
