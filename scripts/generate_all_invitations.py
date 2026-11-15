import json
import os
import shutil
import sys
from PIL import Image, ImageDraw, ImageFont

def main():
    data_path = 'src/data/winningCorporators.json'
    template_path = 'clean_template_300dpi.png'
    qr_dir = 'QR brk'
    out_dir = 'public/invitations'
    out_qr_dir = 'public/invitations/qr'

    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(out_qr_dir, exist_ok=True)

    with open(data_path, 'r', encoding='utf-8') as f:
        winners = json.load(f)

    print(f'Total winning corporators to generate: {len(winners)}')

    template = Image.open(template_path)
    
    # Fonts at 300 DPI (72 pt = 300 px)
    # Corporator Name: 40 pt -> int(40 * 300 / 72) = 167 px
    # Garu: 25 pt -> int(25 * 300 / 72) = 104 px
    # Ward number line: 25 pt -> int(25 * 300 / 72) = 104 px
    font_name = ImageFont.truetype('fonts/Priyaanka-Bold.ttf', int(40 * 300 / 72))
    font_garu = ImageFont.truetype('fonts/Priyaanka-Bold.ttf', int(25 * 300 / 72))
    font_ward = ImageFont.truetype('fonts/Anupama-Thin.ttf', int(25 * 300 / 72))

    color_maroon = '#990912'

    count = 0
    for corporator in winners:
        ward = corporator['ward']
        anu_name = corporator['nameAnu']
        anu_garu = ' >±sÁT'
        anu_ward = f'{ward}e yrsÁ¦T ¿±sÃÎ¹s³sY'

        pua_name = ''.join(chr(0xf000 + ord(c)) if ord(c) < 0x100 else c for c in anu_name)
        pua_garu = ''.join(chr(0xf000 + ord(c)) if ord(c) < 0x100 else c for c in anu_garu)
        pua_ward = ''.join(chr(0xf000 + ord(c)) if ord(c) < 0x100 else c for c in anu_ward)

        card = template.copy()
        draw = ImageDraw.Draw(card)

        # Calculate widths
        w_name = draw.textlength(pua_name, font=font_name)
        w_garu = draw.textlength(pua_garu, font=font_garu)
        total_w_name = w_name + w_garu
        start_x_name = (2160 - total_w_name) / 2

        # Draw Corporator Name at 40pt and Garu at 25pt
        draw.text((start_x_name, 1315), pua_name, font=font_name, fill=color_maroon)
        draw.text((start_x_name + w_name, 1370), pua_garu, font=font_garu, fill=color_maroon)

        # Draw Ward Line at 25pt in Anupama-Thin
        w_ward = draw.textlength(pua_ward, font=font_ward)
        start_x_ward = (2160 - w_ward) / 2
        draw.text((start_x_ward, 1555), pua_ward, font=font_ward, fill=color_maroon)

        # Embed QR Code
        qr_file = os.path.join(qr_dir, f'{ward}.png')
        if os.path.exists(qr_file):
            qr_img = Image.open(qr_file).convert('RGB').resize((473, 473), Image.Resampling.LANCZOS)
            card.paste(qr_img, (104, 1940))
            shutil.copy(qr_file, os.path.join(out_qr_dir, f'{ward}.png'))
        else:
            print(f'WARNING: QR file not found for ward {ward}: {qr_file}')

        # Save High Quality JPEG
        out_jpg = os.path.join(out_dir, f'{ward}.jpg')
        card.convert('RGB').save(out_jpg, 'JPEG', quality=95)
        count += 1

    print(f'Successfully generated {count} invitations in {out_dir}!')

if __name__ == '__main__':
    main()
