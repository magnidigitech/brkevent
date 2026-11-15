const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { execSync } = require('child_process');

async function renderSample(divisionNumber, nameTelugu, divisionLabel) {
  // 1. Generate SVG QR code for Division 31
  const hash = 'pby0';
  const qrUrl = `https://event.bhashyamramakrishna.in/division${divisionNumber}-${hash}`;

  const qrSvg = await QRCode.toString(qrUrl, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#940a14',
      light: '#ffffff',
    },
  });

  // Base64 encode fonts
  const mandaliBoldPath = path.join(__dirname, '../fonts/Mandali_Bold.otf');
  const mandaliBoldBase64 = fs.readFileSync(mandaliBoldPath).toString('base64');

  const mandaliRegPath = path.join(__dirname, '../fonts/Mandali-Regular.ttf');
  const mandaliRegBase64 = fs.readFileSync(mandaliRegPath).toString('base64');

  // Base64 encode the door badge
  const badgePath = path.join(__dirname, '../entry_badge.png');
  const badgeBase64 = fs.readFileSync(badgePath).toString('base64');

  // Base64 encode the 1080x1350 template
  const bgPath = path.join(__dirname, '../new_template_web.png');
  const bgBase64 = fs.readFileSync(bgPath).toString('base64');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: 'MandaliBold';
    src: url('data:font/otf;charset=utf-8;base64,${mandaliBoldBase64}') format('opentype');
    font-weight: normal;
    font-style: normal;
  }

  @font-face {
    font-family: 'MandaliRegular';
    src: url('data:font/truetype;charset=utf-8;base64,${mandaliRegBase64}') format('truetype');
    font-weight: normal;
    font-style: normal;
  }
  
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  body {
    width: 1080px;
    height: 1350px;
    position: relative;
    background-image: url('data:image/png;base64,${bgBase64}');
    background-size: 1080px 1350px;
    background-repeat: no-repeat;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }

  /* Invitee Name in User-Provided Mandali Bold */
  .name-text {
    position: absolute;
    top: 672px;
    left: 0;
    width: 1080px;
    text-align: center;
    color: #c30000;
    font-family: 'MandaliBold', sans-serif;
    font-size: 48px;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: 0.5px;
  }

  /* Division Sub-line in Mandali Regular */
  .sub-text {
    position: absolute;
    top: 752px;
    left: 0;
    width: 1080px;
    text-align: center;
    color: #8b151b;
    font-family: 'MandaliRegular', sans-serif;
    font-size: 32px;
    font-weight: 700;
    line-height: 1.2;
  }

  /* Left Entry QR Box - fits exactly into the template's square box at (71, 993, 192x191) */
  .qr-box {
    position: absolute;
    left: 73px;
    top: 995px;
    width: 188px;
    height: 188px;
    background: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .qr-box svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .qr-badge {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 56px;
    height: 56px;
    border-radius: 50%;
    box-shadow: 0 0 0 3px #ffffff;
  }
</style>
</head>
<body>
  <div class="name-text">${nameTelugu}</div>
  <div class="sub-text">${divisionLabel}</div>

  <div class="qr-box">
    ${qrSvg}
    <img src="data:image/png;base64,${badgeBase64}" class="qr-badge" alt="Entry" />
  </div>
</body>
</html>`;

  const htmlPath = path.join(__dirname, 'new_temp_invitation.html');
  fs.writeFileSync(htmlPath, html);

  const outputPath = path.join(__dirname, '../sample_invitation_division_31_mandali.png');
  const artifactPath = '/Users/venkatavivek/.gemini/antigravity/brain/75b24d41-8a6f-4e00-8724-42f97372af69/sample_invitation_division_31_mandali.png';

  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const cmd = `"${chromePath}" --headless --disable-gpu --screenshot="${outputPath}" --window-size=1080,1350 --default-background-color=00000000 "file://${htmlPath}"`;
  
  execSync(cmd, { stdio: 'pipe' });

  // Copy to artifacts
  fs.copyFileSync(outputPath, artifactPath);
  console.log(`Rendered with Mandali font! Saved to: ${outputPath}`);
}

renderSample(31, 'గంటా వెంకట మౌలిక గారు', '31వ డివిజన్ కార్పొరేటర్');
