#!/usr/bin/env python3
"""
Export PRESENTATION_DECK.md to PowerPoint (.pptx)

Run with: python export_to_pptx.py
Requires: pip install python-pptx
"""

import re
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# ─── Color palette ───
DARK_BG = RGBColor(0x0F, 0x12, 0x1A)      # #0F121A
CARD_BG = RGBColor(0x1A, 0x1E, 0x2A)      # #1A1E2A
ACCENT_CYAN = RGBColor(0x00, 0xD4, 0xAA)  # #00D4AA
ACCENT_BLUE = RGBColor(0x60, 0xA5, 0xFA)  # #60A5FA
ACCENT_YELLOW = RGBColor(0xFD, 0xE0, 0x47) # #FDE047
ACCENT_GREEN = RGBColor(0x4A, 0xDE, 0x80) # #4ADE80
ACCENT_PURPLE = RGBColor(0xC0, 0x84, 0xFC) # #C084FC
ACCENT_RED = RGBColor(0xF8, 0x71, 0x71)   # #F87171
TEXT_PRIMARY = RGBColor(0xE2, 0xE8, 0xF0) # #E2E8F0
TEXT_SECONDARY = RGBColor(0x94, 0xA3, 0xB8) # #94A3B8
TEXT_MUTED = RGBColor(0x64, 0x74, 0x8B)   # #64748B

SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)

def add_bg(slide, color=DARK_BG):
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color

def add_textbox(slide, left, top, width, height, text, font_size=18, bold=False, color=TEXT_PRIMARY, alignment=PP_ALIGN.LEFT, font_name="Calibri"):
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(font_size)
    p.font.bold = bold
    p.font.color.rgb = color
    p.font.name = font_name
    p.alignment = alignment
    return txBox

def add_multiline_textbox(slide, left, top, width, height, lines, font_size=16, color=TEXT_PRIMARY, line_spacing=1.3, font_name="Calibri", bullet=False):
    """lines = list of (text, bold, color, indent_level)"""
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    for i, line_data in enumerate(lines):
        if isinstance(line_data, str):
            text, bold, line_color, indent = line_data, False, color, 0
        else:
            text = line_data[0]
            bold = line_data[1] if len(line_data) > 1 else False
            line_color = line_data[2] if len(line_data) > 2 else color
            indent = line_data[3] if len(line_data) > 3 else 0
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        p.text = text
        p.font.size = Pt(font_size)
        p.font.bold = bold
        p.font.color.rgb = line_color
        p.font.name = font_name
        p.level = indent
        p.space_after = Pt(font_size * (line_spacing - 1))
    return txBox

def add_table(slide, left, top, width, height, headers, rows, font_size=12):
    """Create a formatted table"""
    n_rows = len(rows) + 1
    n_cols = len(headers)
    table_shape = slide.shapes.add_table(n_rows, n_cols, left, top, width, height)
    table = table_shape.table
    
    # Header row
    for j, h in enumerate(headers):
        cell = table.cell(0, j)
        cell.text = h
        for paragraph in cell.text_frame.paragraphs:
            paragraph.font.size = Pt(font_size)
            paragraph.font.bold = True
            paragraph.font.color.rgb = TEXT_PRIMARY
            paragraph.font.name = "Calibri"
            paragraph.alignment = PP_ALIGN.LEFT
        cell.fill.solid()
        cell.fill.fore_color.rgb = RGBColor(0x1E, 0x24, 0x30)
    
    # Data rows
    for i, row in enumerate(rows):
        for j, val in enumerate(row):
            cell = table.cell(i + 1, j)
            cell.text = str(val)
            for paragraph in cell.text_frame.paragraphs:
                paragraph.font.size = Pt(font_size)
                paragraph.font.color.rgb = TEXT_PRIMARY
                paragraph.font.name = "Calibri"
                paragraph.alignment = PP_ALIGN.LEFT
            if i % 2 == 0:
                cell.fill.solid()
                cell.fill.fore_color.rgb = RGBColor(0x12, 0x15, 0x1C)
            else:
                cell.fill.solid()
                cell.fill.fore_color.rgb = CARD_BG
    
    # Auto-fit columns roughly
    for j in range(n_cols):
        table.columns[j].width = Inches(width.inches / n_cols)
    
    return table_shape

def add_code_block(slide, left, top, width, height, code, font_size=11):
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = code
    p.font.size = Pt(font_size)
    p.font.name = "Consolas"
    p.font.color.rgb = RGBColor(0xA6, 0xE3, 0xA1)  # green-ish
    txBox.fill.solid()
    txBox.fill.fore_color.rgb = RGBColor(0x12, 0x15, 0x1C)
    return txBox

def parse_deck(md_path):
    """Parse the markdown deck into slide structures"""
    with open(md_path, 'r') as f:
        content = f.read()
    
    # Split by slide markers (--- or ## Slide)
    slides = []
    current_slide = {"title": "", "content": []}
    
    lines = content.split('\n')
    in_code_block = False
    code_lines = []
    
    for line in lines:
        if line.startswith('# '):
            # Title slide
            if current_slide["title"] or current_slide["content"]:
                slides.append(current_slide)
            current_slide = {"title": line[2:].strip(), "content": [], "type": "title"}
        elif line.startswith('## Slide ') or line.startswith('## '):
            if current_slide["title"] or current_slide["content"]:
                slides.append(current_slide)
            current_slide = {"title": line.lstrip('#').strip(), "content": [], "type": "content"}
        elif line.startswith('```'):
            if in_code_block:
                current_slide["content"].append(("code", "\n".join(code_lines)))
                code_lines = []
                in_code_block = False
            else:
                in_code_block = True
        elif in_code_block:
            code_lines.append(line)
        elif line.startswith('| ') and '|' in line[2:]:
            # Table row
            current_slide["content"].append(("table_row", line))
        elif line.strip() == '---':
            # Horizontal rule - could be slide separator
            pass
        elif line.strip():
            current_slide["content"].append(("text", line))
    
    if current_slide["title"] or current_slide["content"]:
        slides.append(current_slide)
    
    # Post-process tables
    processed_slides = []
    for slide in slides:
        new_content = []
        table_buffer = []
        for item in slide["content"]:
            if item[0] == "table_row":
                table_buffer.append(item[1])
            else:
                if table_buffer:
                    new_content.append(("table", table_buffer))
                    table_buffer = []
                new_content.append(item)
        if table_buffer:
            new_content.append(("table", table_buffer))
        slide["content"] = new_content
        processed_slides.append(slide)
    
    return processed_slides

def render_slide(prs, slide_data):
    slide = prs.slides.add_slide(prs.slide_layouts[6])  # blank layout
    add_bg(slide)
    
    title = slide_data["title"]
    content = slide_data["content"]
    
    if slide_data.get("type") == "title":
        # Title slide - centered, large
        add_textbox(slide, Inches(1), Inches(1.5), Inches(11), Inches(1.5), 
                   title, font_size=44, bold=True, color=ACCENT_CYAN, alignment=PP_ALIGN.CENTER)
        # Subtitle from first content
        if content and content[0][0] == "text":
            add_textbox(slide, Inches(1), Inches(3.2), Inches(11), Inches(1), 
                       content[0][1], font_size=24, color=TEXT_SECONDARY, alignment=PP_ALIGN.CENTER)
        # Tagline
        add_textbox(slide, Inches(1), Inches(4.5), Inches(11), Inches(0.8), 
                   "Go / No-Go / Niche verdicts from live demand + supply research", 
                   font_size=18, color=ACCENT_YELLOW, alignment=PP_ALIGN.CENTER)
        return
    
    # Regular content slide
    # Title bar
    add_textbox(slide, Inches(0.6), Inches(0.3), Inches(12), Inches(0.7), 
               title, font_size=28, bold=True, color=ACCENT_CYAN)
    
    # Underline
    underline = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.6), Inches(1.0), Inches(2), Pt(3))
    underline.fill.solid()
    underline.fill.fore_color.rgb = ACCENT_CYAN
    underline.line.fill.background()
    
    y = Inches(1.2)
    left = Inches(0.8)
    content_width = Inches(11.5)
    
    i = 0
    while i < len(content):
        item_type, item_data = content[i]
        
        if item_type == "text":
            line = item_data
            # Detect formatting
            bold = False
            color = TEXT_PRIMARY
            font_size = 16
            indent = 0
            
            if line.startswith('### '):
                line = line[4:]
                bold = True
                font_size = 20
                color = ACCENT_YELLOW
            elif line.startswith('#### '):
                line = line[5:]
                bold = True
                font_size = 17
                color = ACCENT_BLUE
            elif line.startswith('> '):
                line = line[2:]
                color = TEXT_MUTED
                font_size = 14
                indent = 1
            elif line.startswith('- ') or line.startswith('* '):
                line = '• ' + line[2:]
                indent = 1
            elif line.startswith('  - ') or line.startswith('  * '):
                line = '  ◦ ' + line[4:]
                indent = 2
            elif line.startswith('**') and '**' in line[2:]:
                # Bold inline - handle simply
                pass
            
            add_multiline_textbox(slide, left, y, content_width, Inches(0.5),
                                 [(line, bold, color, indent)], font_size=font_size)
            y += Inches(0.4)
        
        elif item_type == "code":
            code = item_data
            add_code_block(slide, left, y, content_width, Inches(2.5), code)
            y += Inches(2.7)
        
        elif item_type == "table":
            rows_data = item_data
            # Parse markdown table
            if len(rows_data) >= 2:
                headers = [c.strip() for c in rows_data[0].split('|')[1:-1]]
                # Skip separator row
                data_rows = []
                for row_line in rows_data[2:]:
                    cells = [c.strip() for c in row_line.split('|')[1:-1]]
                    if cells:
                        data_rows.append(cells)
                
                if headers and data_rows:
                    table_h = min(Inches(0.35 * len(data_rows) + 0.5), Inches(4))
                    add_table(slide, left, y, content_width, table_h, headers, data_rows, font_size=11)
                    y += table_h + Inches(0.3)
        
        i += 1
    
    # Slide number
    add_textbox(slide, Inches(12.5), Inches(7.0), Inches(0.8), Inches(0.4),
               str(prs.slides.index(slide) + 1), font_size=10, color=TEXT_MUTED, alignment=PP_ALIGN.RIGHT)

def main():
    md_path = "PRESENTATION_DECK.md"
    out_path = "LaunchLens_Presentation.pptx"
    
    print(f"Parsing {md_path}...")
    slides_data = parse_deck(md_path)
    print(f"Found {len(slides_data)} slides")
    
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H
    
    for i, slide_data in enumerate(slides_data):
        print(f"Rendering slide {i+1}: {slide_data['title'][:50]}...")
        render_slide(prs, slide_data)
    
    prs.save(out_path)
    print(f"Saved to {out_path}")

if __name__ == "__main__":
    main()