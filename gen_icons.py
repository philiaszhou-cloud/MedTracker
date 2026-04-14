"""
生成 MedReminderAI TabBar 图标
尺寸: 81x81 px (uni-app 推荐)
"""
from PIL import Image, ImageDraw, ImageFont
import os

OUTPUT_DIR = r"C:\Users\ThinkPad\WorkBuddy\20260329135447\MedReminderAI\src\static\tab"
SIZE = 81

# 颜色定义
COLOR_NORMAL = (153, 153, 153)   # 未选中 #999999
COLOR_ACTIVE = (25, 118, 210)    # 选中  #1976D2
COLOR_TRANSPARENT = (0, 0, 0, 0)

def new_img():
    return Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

def draw_home(img, color):
    """房子图标"""
    d = ImageDraw.Draw(img)
    s = SIZE
    # 屋顶三角
    roof = [(s//2, 8), (8, 40), (s-8, 40)]
    d.polygon(roof, fill=color)
    # 门框矩形
    d.rectangle([18, 40, s-18, s-10], fill=color)
    # 门洞（挖空）
    d.rectangle([30, 52, s-30, s-10], fill=(0,0,0,0))

def draw_med(img, color):
    """药片图标 - 胶囊形"""
    d = ImageDraw.Draw(img)
    s = SIZE
    cx, cy = s//2, s//2
    # 外圆角矩形（药片轮廓）
    d.rounded_rectangle([10, 20, s-10, s-20], radius=20, fill=color)
    # 中间横线（分割）
    d.rectangle([10, cy-4, s-10, cy+4], fill=(0,0,0,0))
    # 分割线重新用白色
    d.rectangle([10, cy-3, s-10, cy+3], fill=(255,255,255,180))

def draw_scan(img, color):
    """扫描/相机图标"""
    d = ImageDraw.Draw(img)
    s = SIZE
    # 相机主体
    d.rounded_rectangle([8, 22, s-8, s-14], radius=10, fill=color)
    # 镜头
    d.ellipse([22, 28, s-22, s-20], fill=(255,255,255,200))
    d.ellipse([30, 36, s-30, s-28], fill=color)
    # 取景框（左上角小矩形）
    d.rounded_rectangle([10, 14, 26, 24], radius=3, fill=color)

def draw_history(img, color):
    """记录/日历图标"""
    d = ImageDraw.Draw(img)
    s = SIZE
    # 日历外框
    d.rounded_rectangle([8, 14, s-8, s-8], radius=10, fill=color)
    # 顶部深色标题栏
    d.rounded_rectangle([8, 14, s-8, 34], radius=10, fill=tuple(max(0,c-40) for c in color))
    # 顶部挂钩
    d.rectangle([24, 8, 30, 22], fill=color)
    d.rectangle([s-30, 8, s-24, 22], fill=color)
    # 白色小格子（日历格）
    for row in range(3):
        for col in range(3):
            x = 16 + col * 18
            y = 38 + row * 14
            d.rectangle([x, y, x+10, y+8], fill=(255,255,255,200))

icons = [
    ("home",    draw_home),
    ("med",     draw_med),
    ("scan",    draw_scan),
    ("history", draw_history),
]

for name, draw_fn in icons:
    for suffix, color in [("", COLOR_NORMAL), ("-active", COLOR_ACTIVE)]:
        img = new_img()
        draw_fn(img, color)
        fname = f"{name}{suffix}.png"
        path = os.path.join(OUTPUT_DIR, fname)
        img.save(path, "PNG")
        print(f"  OK: {fname}")

print("All icons generated!")
