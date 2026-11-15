import json
import os
import sys
import subprocess
from PIL import Image, ImageDraw, ImageFont

def main():
    data_path = 'src/data/winningCorporators.json'
    template_path = 'base_template_300dpi.png'
    qr_dir = 'QR brk'
    out_dir = 'public/invitations'
    out_qr_dir = 'public/invitations/qr'
    wardu_asset_path = 'scripts/assets/wardu_corp_alpha.png'

    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(out_qr_dir, exist_ok=True)

    with open(data_path, 'r', encoding='utf-8') as f:
        winners = json.load(f)

    print(f'Total winning corporators to generate: {len(winners)}')

    template = Image.open(template_path)
    wardu_corp_img = Image.open(wardu_asset_path)
    
    # Fonts at 300 DPI (72 pt = 300 px)
    # Corporator Name: 40 pt -> int(40 * 300 / 72) = 167 px
    # Garu: 25 pt -> int(25 * 300 / 72) = 104 px
    # Ward number prefix: 25 pt -> int(25 * 300 / 72) = 104 px
    font_name = ImageFont.truetype('fonts/Priyaanka-Bold.ttf', int(40 * 300 / 72))
    font_garu = ImageFont.truetype('fonts/Priyaanka-Bold.ttf', int(25 * 300 / 72))
    font_ward = ImageFont.truetype('fonts/Anupama-Thin.ttf', int(25 * 300 / 72))

    color_maroon = '#990912'

    count = 0
    for corporator in winners:
        ward = corporator['ward']
        anu_name = corporator['nameAnu']
        anu_garu = ' >±sÁT'

        pua_name = ''.join(chr(0xf000 + ord(c)) if ord(c) < 0x100 else c for c in anu_name)
        pua_garu = ''.join(chr(0xf000 + ord(c)) if ord(c) < 0x100 else c for c in anu_garu)

        card = template.copy()
        draw = ImageDraw.Draw(card)

        # 1. Corporator Name + Garu (Priyaanka Bold 40pt + 25pt)
        w_name = draw.textlength(pua_name, font=font_name)
        w_garu = draw.textlength(pua_garu, font=font_garu)
        total_w_name = w_name + w_garu
        start_x_name = (2160 - total_w_name) / 2

        draw.text((start_x_name, 1345), pua_name, font=font_name, fill=color_maroon)
        draw.text((start_x_name + w_name, 1400), pua_garu, font=font_garu, fill=color_maroon)

        # 2. Ward Line: "[N]వ వార్డు కార్పొరేటర్"
        # Prefix "[N]e" renders "[N]వ" in Anupama-Thin (e.g. "1e" -> "1వ", "31e" -> "31వ")
        prefix = f'{ward}e'
        pua_prefix = ''.join(chr(0xf000 + ord(c)) for c in prefix)
        w_prefix = draw.textlength(pua_prefix, font=font_ward)
        gap = 24
        total_w_ward = w_prefix + gap + wardu_corp_img.width
        start_x_ward = (2160 - total_w_ward) / 2

        # Draw prefix "[N]వ"
        draw.text((start_x_ward, 1565), pua_prefix, font=font_ward, fill=color_maroon)
        # Paste "వార్డు కార్పొరేటర్" with exact baseline alignment
        card.paste(wardu_corp_img, (int(start_x_ward + w_prefix + gap), 1545), wardu_corp_img)

        # 3. Process and Embed Entry QR Code
        qr_file = os.path.join(qr_dir, f'{ward}.png')
        if os.path.exists(qr_file):
            qr_img = Image.open(qr_file)
            # Crop out outer cream background padding (59, 59, 541, 541)
            qr_cropped = qr_img.crop((59, 59, 541, 541))
            # Resize cropped QR to 379x379 (matches Location QR exactly)
            qr_resized = qr_cropped.resize((379, 379), Image.Resampling.LANCZOS)
            # Paste symmetrically at (150, 1987) - leaving 30px gap above ENTRY PASS text
            card.paste(qr_resized, (150, 1987))

            # Save clean cropped QR for user download
            qr_out_file = os.path.join(out_qr_dir, f'{ward}.png')
            qr_cropped.save(qr_out_file)
        else:
            print(f'WARNING: QR file not found for ward {ward}: {qr_file}')

        # Save High Quality JPEG (300 DPI, 2160x2700)
        out_jpg = os.path.join(out_dir, f'{ward}.jpg')
        card.convert('RGB').save(out_jpg, 'JPEG', quality=95)
        count += 1

    print(f'Successfully generated all {count} invitations in {out_dir}!')

    # If --upload-online flag passed, sync to Supabase Storage
    if '--upload-online' in sys.argv:
        print('Syncing generated invitations to Supabase Storage...')
        subprocess.run(['node', '--env-file=.env.local', '-e', '''
            const { uploadAllInvitationsToSupabase } = require("./scripts/upload_to_supabase.ts");
        '''], check=False)

if __name__ == '__main__':
    main()
