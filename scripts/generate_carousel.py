import os
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1080

# Paths to system fonts
FONT_BOLD = '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf'
FONT_REG = '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf'

def get_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except:
        return ImageFont.load_default()

def draw_clean_background(draw):
    # 1. Elegant Deep Navy (#080C1A) to Dark Slate Gradient (#12102A)
    for y in range(H):
        ratio = y / H
        r = int(8 + (20 - 8) * ratio)
        g = int(12 + (14 - 12) * ratio)
        b = int(26 + (48 - 26) * ratio)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # 2. Subtle Tech Grid Dots (Low Opacity)
    grid_size = 45
    for x in range(45, W - 45, grid_size):
        for y in range(45, H - 45, grid_size):
            draw.point((x, y), fill=(22, 32, 54))

    # 3. Soft Ambient Vignette / Glow
    draw.ellipse([W - 320, -100, W + 120, 340], fill=(18, 14, 40))
    draw.ellipse([-120, H - 320, 340, H + 140], fill=(10, 20, 42))

def draw_header(draw, brand_text="RAFIQSPACE.AI", tag_text="HARI GURU NASIONAL 2026"):
    # Logo / Brand Pill Top Left
    draw.ellipse([88, 86, 100, 98], fill=(0, 194, 255)) # Glowing cyan dot
    font_brand = get_font(FONT_BOLD, 22)
    draw.text((112, 82), brand_text, fill=(245, 248, 255), font=font_brand)

    # Clean Pill Tag Top Right (No stray dangling lines)
    font_tag = get_font(FONT_BOLD, 15)
    tag_bbox = font_tag.getbbox(tag_text)
    tw = tag_bbox[2] - tag_bbox[0]
    badge_x = W - 90 - tw - 32
    draw.rounded_rectangle([badge_x, 74, W - 90, 110], radius=18, fill=(14, 24, 48), outline=(0, 194, 255), width=1)
    draw.text((badge_x + 16, 83), tag_text, fill=(0, 194, 255), font=font_tag)

def draw_footer_progress(draw, current_slide, total_slides=3):
    y_pos = H - 90
    bar_width = 80
    gap = 12
    start_x = 90

    # Draw 3 progress indicator bars (Cleanly aligned, no intersecting lines)
    for i in range(total_slides):
        bx = start_x + (i * (bar_width + gap))
        if i + 1 == current_slide:
            # Active bar (Cyan glow)
            draw.rounded_rectangle([bx, y_pos, bx + bar_width, y_pos + 6], radius=3, fill=(0, 194, 255))
        elif i + 1 < current_slide:
            # Completed bar (Electric Purple)
            draw.rounded_rectangle([bx, y_pos, bx + bar_width, y_pos + 6], radius=3, fill=(120, 60, 240))
        else:
            # Inactive bar (Dark Grey)
            draw.rounded_rectangle([bx, y_pos, bx + bar_width, y_pos + 6], radius=3, fill=(35, 45, 70))

    # Swipe text or CTA on the right
    font_sub = get_font(FONT_BOLD, 18)
    if current_slide < total_slides:
        swipe_text = f"Slide {current_slide}/{total_slides}  Geser ->"
        color = (180, 205, 235)
    else:
        swipe_text = f"Slide 3/3  Simpan & Bagikan"
        color = (0, 194, 255)
    
    bbox = font_sub.getbbox(swipe_text)
    sw = bbox[2] - bbox[0]
    draw.text((W - 90 - sw, y_pos - 7), swipe_text, fill=color, font=font_sub)

def wrap_text(text, font, max_width, draw):
    lines = []
    paragraphs = text.split('\n')
    for p in paragraphs:
        if not p.strip():
            lines.append("")
            continue
        words = p.split()
        current_line = []
        for word in words:
            test_line = " ".join(current_line + [word])
            bbox = font.getbbox(test_line)
            if bbox[2] - bbox[0] <= max_width:
                current_line.append(word)
            else:
                if current_line:
                    lines.append(" ".join(current_line))
                current_line = [word]
        if current_line:
            lines.append(" ".join(current_line))
    return lines

# ==============================================================
# SLIDE 1: COVER HOOK
# ==============================================================
def create_slide_1(out_path):
    img = Image.new('RGB', (W, H), (8, 12, 26))
    draw = ImageDraw.Draw(img)
    draw_clean_background(draw)
    draw_header(draw, tag_text="HARI GURU NASIONAL 2026")

    # Kicker / Topic Pill
    draw.rounded_rectangle([90, 250, 400, 296], radius=8, fill=(24, 18, 55), outline=(120, 60, 240), width=1)
    font_kicker = get_font(FONT_BOLD, 17)
    draw.text((110, 262), "AI BERETIKA & KEDAULATAN", fill=(200, 180, 255), font=font_kicker)

    # Big Headline
    font_hl = get_font(FONT_BOLD, 54)
    hl_text = "Sudahkah Teknologi\nMemuliakan Guru Kita?"
    lines = hl_text.split('\n')
    y = 340
    for line in lines:
        draw.text((90, y), line, fill=(255, 255, 255), font=font_hl)
        y += 72

    # Decorative Cyan Line
    draw.rectangle([90, y + 20, 210, y + 26], fill=(0, 194, 255))

    # Sub-headline / Narrative
    font_body = get_font(FONT_REG, 25)
    sub_text = (
        "Di ruang kelas Nusantara, guru menyalakan lentera peradaban.\n\n"
        "Namun, sudahkah digitalisasi hari ini benar-benar meringankan "
        "tugas mereka, atau justru menjebak pendidik dalam tumpukan tugas klerikal?"
    )
    y_sub = y + 65
    for l in wrap_text(sub_text, font_body, 900, draw):
        if not l:
            y_sub += 16
            continue
        draw.text((90, y_sub), l, fill=(185, 205, 235), font=font_body)
        y_sub += 36

    draw_footer_progress(draw, current_slide=1)
    img.save(out_path, quality=95)
    print(f"[OK] Slide 1 saved to: {out_path}")

# ==============================================================
# SLIDE 2: INSIGHT & CORE THESIS (POLISHED)
# ==============================================================
def create_slide_2(out_path):
    img = Image.new('RGB', (W, H), (8, 12, 26))
    draw = ImageDraw.Draw(img)
    draw_clean_background(draw)
    draw_header(draw, tag_text="CORE THESIS · INSIGHT")

    # Kicker
    draw.rounded_rectangle([90, 210, 395, 256], radius=8, fill=(14, 28, 52), outline=(0, 194, 255), width=1)
    font_kicker = get_font(FONT_BOLD, 17)
    draw.text((110, 222), "FILOSOFI TEKNOLOGI GURU", fill=(0, 194, 255), font=font_kicker)

    # Headline
    font_hl = get_font(FONT_BOLD, 46)
    hl_text = "AI Tak Akan Pernah Menggantikan\nSentuhan Jiwa Seorang Pendidik."
    y = 290
    for line in hl_text.split('\n'):
        draw.text((90, y), line, fill=(255, 255, 255), font=font_hl)
        y += 62

    # Card Box for Key Arguments (Balanced Height & Radius)
    card_y = y + 35
    card_h = 300
    draw.rounded_rectangle([90, card_y, W - 90, card_y + card_h], radius=16, fill=(14, 22, 44), outline=(40, 60, 100), width=1)

    # Subtle inner accent bar inside card with proper padding
    draw.rounded_rectangle([112, card_y + 36, 116, card_y + 265], radius=2, fill=(120, 60, 240))

    font_card_lead = get_font(FONT_BOLD, 23)
    draw.text((135, card_y + 30), "Peran Sejati Kecerdasan Artifisial di Sekolah:", fill=(0, 194, 255), font=font_card_lead)

    font_card_body = get_font(FONT_REG, 22)
    body_points = (
        "• AI hadir bukan untuk menduplikasi jiwa atau empati pendidik.\n\n"
        "• Teknologi harus memangkas beban klerikal dan pelaporan rutin.\n\n"
        "• Mengembalikan waktu berharga agar guru fokus membimbing karakter murid."
    )
    cy = card_y + 78
    for l in wrap_text(body_points, font_card_body, 810, draw):
        if not l:
            cy += 14
            continue
        draw.text((135, cy), l, fill=(215, 225, 245), font=font_card_body)
        cy += 32

    draw_footer_progress(draw, current_slide=2)
    img.save(out_path, quality=95)
    print(f"[OK] Slide 2 saved to: {out_path}")

# ==============================================================
# SLIDE 3: RESOLUTION & CALL TO ACTION (POLISHED)
# ==============================================================
def create_slide_3(out_path):
    img = Image.new('RGB', (W, H), (8, 12, 26))
    draw = ImageDraw.Draw(img)
    draw_clean_background(draw)
    draw_header(draw, tag_text="KEDAULATAN DATA")

    # Kicker
    draw.rounded_rectangle([90, 210, 425, 256], radius=8, fill=(24, 18, 55), outline=(120, 60, 240), width=1)
    font_kicker = get_font(FONT_BOLD, 17)
    draw.text((110, 222), "DATA SOVEREIGNTY ENTERPRISE", fill=(200, 180, 255), font=font_kicker)

    # Headline
    font_hl = get_font(FONT_BOLD, 46)
    hl_text = "Bangsa Berdaulat Lahir dari\nPahlawan Pendidikan yang Berdaya."
    y = 290
    for line in hl_text.split('\n'):
        draw.text((90, y), line, fill=(255, 255, 255), font=font_hl)
        y += 62

    # Narrative
    font_body = get_font(FONT_REG, 24)
    narration = (
        "Mendidik talenta masa depan membutuhkan infrastruktur AI yang aman, "
        "tangguh, dan data sensitif tetap berada di bawah kendali mandiri bangsa.\n\n"
        "Bagi Rafiqspace.ai, Kedaulatan Data dan Responsible AI bukanlah opsi teknis, "
        "melainkan komitmen etis untuk generasi penerus peradaban."
    )
    y_nar = y + 30
    for l in wrap_text(narration, font_body, 900, draw):
        if not l:
            y_nar += 16
            continue
        draw.text((90, y_nar), l, fill=(185, 205, 235), font=font_body)
        y_nar += 34

    # CTA Box (Clean Glowing Card)
    cta_y = y_nar + 40
    draw.rounded_rectangle([90, cta_y, W - 90, cta_y + 110], radius=16, fill=(14, 26, 54), outline=(0, 194, 255), width=2)
    
    font_cta_bold = get_font(FONT_BOLD, 25)
    font_cta_sub = get_font(FONT_REG, 20)
    
    draw.text((125, cta_y + 24), "Mari Wujudkan Ekosistem AI Berdaulat Nasional", fill=(255, 255, 255), font=font_cta_bold)
    draw.text((125, cta_y + 64), "Kunjungi portal resmi: rafiqspace.ai · Solusi AI Enterprise & Sektor Publik", fill=(0, 194, 255), font=font_cta_sub)

    draw_footer_progress(draw, current_slide=3)
    img.save(out_path, quality=95)
    print(f"[OK] Slide 3 saved to: {out_path}")

if __name__ == '__main__':
    out_dir = '/home/webserver-xeron/workspace'
    s1 = os.path.join(out_dir, 'carousel_slide_1.png')
    s2 = os.path.join(out_dir, 'carousel_slide_2.png')
    s3 = os.path.join(out_dir, 'carousel_slide_3.png')

    create_slide_1(s1)
    create_slide_2(s2)
    create_slide_3(s3)
    print("All 3 carousel slides regenerated flawlessly!")
