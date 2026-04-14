"""
生成苹果 SF Symbols 风格的 TabBar 图标
- 81x81px 画布（uni-app TabBar 标准尺寸）
- 2px 描边，圆润端点（round cap + round join）
- 简洁线条风格，与 iOS 原生应用一致
"""

from PIL import Image, ImageDraw
import os, math

SIZE = 81
CENTER = SIZE // 2
STROKE_WIDTH = 2
# 苹果系统灰
COLOR_NORMAL = (142, 142, 147)  # #8E8E93
# 霓虹青（选中态）
COLOR_ACTIVE = (0, 229, 255)   # #00E5FF

OUTPUT_DIR = r"e:\Medtracker\static\tab"

def new_canvas(color):
    """创建透明画布"""
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)

def save(img, name):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = os.path.join(OUTPUT_DIR, name)
    img.save(path)
    print(f"  OK {path}")

# ─── 图标1: 首页 — House (SF house.fill 风格) ───
def draw_home(color):
    img, d = new_canvas(color)
    # 屋顶三角形
    roof = [
        (CENTER - 18, 32),  # 左顶点
        (CENTER, 16),       # 顶部尖端
        (CENTER + 18, 32),  # 右顶点
    ]
    d.line(roof + [roof[0]], fill=color, width=STROKE_WIDTH, joint="curve")
    # 房身矩形（底部开口）
    body = [
        (CENTER - 16, 32), (CENTER - 16, 58),
        (CENTER + 16, 58), (CENTER + 16, 32),
    ]
    d.line(body, fill=color, width=STROKE_WIDTH, joint="curve")
    # 门
    door = [
        (CENTER - 6, 58), (CENTER - 6, 46),
        (CENTER + 6, 46), (CENTER + 6, 58),
    ]
    d.line(door, fill=color, width=STROKE_WIDTH, joint="curve")
    # 烟囱
    chimney = [
        (CENTER + 8, 20), (CENTER + 8, 12),
        (CENTER + 14, 12), (CENTER + 14, 24),
    ]
    d.line(chimney, fill=color, width=STROKE_WIDTH, joint="curve")
    return img

# ─── 图标2: 药品 — Capsule Pill (胶囊药丸) ───
def draw_med(color):
    img, d = new_canvas(color)
    cx, cy = CENTER, CENTER
    # 胶囊形状：圆角矩形倾斜45度，用两半圆+矩形模拟
    # 简化为水平胶囊
    rx, ry = 16, 10  # 半长轴、半短轴
    # 左半圆
    d.ellipse([cx - rx, cy - ry, cx - rx + ry*2, cy + ry], outline=color, width=STROKE_WIDTH)
    # 右半圆
    d.ellipse([cx + rx - ry*2, cy - ry, cx + rx, cy + ry], outline=color, width=STROKE_WIDTH)
    # 中间连接线（上下）
    d.line([(cx - rx + ry, cy - ry), (cx + rx - ry, cy - ry)], fill=color, width=STROKE_WIDTH)
    d.line([(cx - rx + ry, cy + ry), (cx + rx - ry, cy + ry)], fill=color, width=STROKE_WIDTH)
    # 中间分隔线（药丸两半效果）
    d.line([(cx, cy - ry + 2), (cx, cy + ry - 2)], fill=color, width=STROKE_WIDTH)
    return img

# ─── 图标3: 拍照 — Camera (SF camera 风格) ───
def draw_scan(color):
    img, d = new_canvas(color)
    cx, cy = CENTER, CENTER
    # 外框圆角矩形（相机机身）
    pad = 4
    r = 8
    body = [
        (cx - 24, cy - 15 + r),
        (cx - 24, cy + 15 - r),
        (cx - 24 + r, cy + 15),
        (cx + 24 - r, cy + 15),
        (cx + 24, cy + 15 - r),
        (cx + 24, cy - 15 + r),
        (cx + 24 - r, cy - 15),
        (cx - 24 + r, cy - 15),
        (cx - 24, cy - 15 + r),
    ]
    d.line(body, fill=color, width=STROKE_WIDTH, joint="curve")
    # 顶部突起（取景器）
    viewfinder = [
        (cx - 6, cy - 15), (cx - 6, cy - 21),
        (cx + 6, cy - 21), (cx + 6, cy - 15),
    ]
    d.line(viewfinder, fill=color, width=STROKE_WIDTH, joint="curve")
    # 镜头外圈
    d.ellipse([cx - 11, cy - 9, cx + 11, cy + 9], outline=color, width=STROKE_WIDTH)
    # 镜头内圈
    d.ellipse([cx - 6, cy - 4, cx + 6, cy + 4], outline=color, width=STROKE_WIDTH)
    # 右侧小按钮（闪光灯）
    d.ellipse([cx + 16, cy - 6, cx + 22, cy], outline=color, width=STROKE_WIDTH)
    return img

# ─── 图标4: 记录 — Clock (SF clock 风格) ───
def draw_history(color):
    img, d = new_canvas(color)
    cx, cy = CENTER, CENTER + 1
    # 圆形表盘
    d.ellipse([cx - 18, cy - 18, cx + 18, cy + 18], outline=color, width=STROKE_WIDTH)
    # 刻度标记（12点、3点、6点、9点）
    for angle in [0, 90, 180, 270]:
        rad = math.radians(angle)
        inner_r = 14
        outer_r = 17
        x1 = cx + inner_r * math.cos(rad)
        y1 = cy - inner_r * math.sin(rad)
        x2 = cx + outer_r * math.cos(rad)
        y2 = cy - outer_r * math.sin(rad)
        d.line([(x1, y1), (x2, y2)], fill=color, width=STROKE_WIDTH)
    # 时针（短，指向~10点）
    hour_angle = math.radians(-150)
    hx = 8 * math.cos(hour_angle)
    hy = 8 * math.sin(hour_angle)
    d.line([(cx, cy), (cx + hx, cy + hy)], fill=color, width=STROKE_WIDTH)
    # 分针（长，指向~2点）
    min_angle = math.radians(-60)
    mx = 13 * math.cos(min_angle)
    my = 13 * math.sin(min_angle)
    d.line([(cx, cy), (cx + mx, cy + my)], fill=color, width=STROKE_WIDTH)
    # 中心圆点
    cr = 2.5
    d.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=color)
    return img


if __name__ == "__main__":
    print("[SF Icons] Generating Apple-style icons...\n")
    
    icons = [
        ("home", draw_home, "首页"),
        ("med", draw_med, "药品"),
        ("scan", draw_scan, "拍照"),
        ("history", draw_history, "记录"),
    ]
    
    for key, fn, label in icons:
        print(f"  [{label}] ({key})")
        normal_img = fn(COLOR_NORMAL)
        save(normal_img, f"{key}.png")
        active_img = fn(COLOR_ACTIVE)
        save(active_img, f"{key}-active.png")
    
    print(f"\n[DONE] {len(icons)*2} icons saved to {OUTPUT_DIR}")
