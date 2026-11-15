import sys
import os
import fitz # PyMuPDF
from PIL import Image

def process_template(input_file, output_file='base_template_300dpi.png'):
    print(f"Processing template: {input_file}")
    ext = os.path.splitext(input_file)[1].lower()
    
    if ext == '.pdf':
        doc = fitz.open(input_file)
        page = doc.load_page(0)
        # Render at 300 DPI (300 / 72 = 4.16666667 zoom)
        zoom = 300.0 / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        pix.save(output_file)
        doc.close()
        print(f"Rendered PDF page 0 to {output_file} at 300 DPI ({pix.width}x{pix.height})")
    else:
        # Image file (PNG, JPG, WebP, etc.)
        img = Image.open(input_file).convert('RGB')
        # Standardize size to 2160 x 2700 if slightly different
        if img.size != (2160, 2700):
            print(f"Resizing from {img.size} to (2160, 2700)")
            img = img.resize((2160, 2700), Image.Resampling.LANCZOS)
        img.save(output_file, 'PNG')
        print(f"Saved image template to {output_file}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 update_template.py <input_template_path>")
        sys.exit(1)
    process_template(sys.argv[1])
