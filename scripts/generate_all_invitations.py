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

    # Baseline coordinates at 300 DPI (calibrated to official PDF layout):
    # Corporator Name & Garu baseline: y = 1433
    # Ward line baseline: y = 1608
    # In wardu_corp_alpha.png, the glyph baseline is at row 60
    Y_NAME_BASELINE = 1433
    Y_WARD_BASELINE = 1608
    ASSET_BASELINE_OFFSET = 60

    count = 0
    for corporator in winners:
        ward = corporator['ward']
        anu_name = corporator['nameAnu']
        anu_garu = ' >±sÁT'

        pua_name = ''.join(chr(0xf000 + ord(c)) if ord(c) < 0x100 else c for c in anu_name)
        pua_garu = ''.join(chr(0xf000 + ord(c)) if ord(c) < 0x100 else c for c in anu_garu)

        card = template.copy()
        draw = ImageDraw.Draw(card)

        # 1. Corporator Name + Garu (Priyaanka Bold 40pt + 25pt, baseline aligned with anchor='ls')
        w_name = draw.textlength(pua_name, font=font_name)
        w_garu = draw.textlength(pua_garu, font=font_garu)
        total_w_name = w_name + w_garu
        start_x_name = (2160 - total_w_name) / 2

        draw.text((start_x_name, Y_NAME_BASELINE), pua_name, font=font_name, fill=color_maroon, anchor='ls')
        draw.text((start_x_name + w_name, Y_NAME_BASELINE), pua_garu, font=font_garu, fill=color_maroon, anchor='ls')

        # 2. Ward Line: "[N]వ వార్డు కార్పొరేటర్"
        # Prefix "[N]e" renders "[N]వ" in Anupama-Thin (e.g. "1e" -> "1వ", "31e" -> "31వ")
        prefix = f'{ward}e'
        pua_prefix = ''.join(chr(0xf000 + ord(c)) for c in prefix)
        w_prefix = draw.textlength(pua_prefix, font=font_ward)
        gap = 26
        total_w_ward = w_prefix + gap + wardu_corp_img.width
        start_x_ward = (2160 - total_w_ward) / 2

        # Draw prefix "[N]వ" using anchor='ls' so number and 'వ' sit on exact baseline 1608
        draw.text((start_x_ward, Y_WARD_BASELINE), pua_prefix, font=font_ward, fill=color_maroon, anchor='ls')
        # Paste "వార్డు కార్పొరేటర్" at Y_WARD_BASELINE - ASSET_BASELINE_OFFSET so letters sit on exact same baseline 1608
        card.paste(wardu_corp_img, (int(start_x_ward + w_prefix + gap), Y_WARD_BASELINE - ASSET_BASELINE_OFFSET), wardu_corp_img)

        # 3. Entry QR Code (cropped without outer cream padding, placed above ENTRY PASS)
        # Symmetrically matching LOCATION QR on right (379x379 at y=1987)
        qr_file = os.path.join(qr_dir, f'{ward}.png')
        if os.path.exists(qr_file):
            qr_img = Image.open(qr_file)
            # Crop outer 59px cream padding to keep pure QR code modules
            crop_box = (59, 59, qr_img.width - 59, qr_img.height - 59)
            pure_qr = qr_img.crop(crop_box).resize((379, 379), Image.Resampling.LANCZOS)

            # Save clean cropped QR for direct download
            pure_qr.save(os.path.join(out_qr_dir, f'{ward}.png'))

            # Paste QR on card at (150, 1987)
            card.paste(pure_qr, (150, 1987))
        else:
            print(f'Warning: QR file not found for ward {ward}: {qr_file}')

        # Save high quality JPEG (300 DPI)
        out_file = os.path.join(out_dir, f'{ward}.jpg')
        card.save(out_file, 'JPEG', quality=95, dpi=(300, 300))
        count += 1

    print(f'Successfully generated all {count} invitations in {out_dir}!')

if __name__ == '__main__':
    main()
