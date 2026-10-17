# tools/blender/kit_v1_textures.py - owns original deterministic painted stone, timber, tile and iron texels.
import argparse
import math
from pathlib import Path
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

KEYS = "air stone tower gate wood floor stairs ladder door roof magazine palace mount foundation".split()
SIZE, GUTTER, INNER = 256, 8, 240


def noisy(image, seed, strength=5):
    rng = np.random.default_rng(seed)
    data = np.asarray(image.convert("RGB")).astype(float)
    grain = rng.normal(0, strength, (*data.shape[:2], 1))
    coarse = Image.fromarray(rng.integers(0, 255, (16, 16), dtype=np.uint8)).resize(image.size, Image.Resampling.BICUBIC)
    grain += (np.asarray(coarse)[:, :, None].astype(float) - 128) * 0.055
    return Image.fromarray(np.clip(data + grain, 0, 255).astype(np.uint8)).convert("RGBA")


def ashlar(seed, dark=False, flag=False, fine=False):
    rng = random.Random(seed)
    image = Image.new("RGB", (INNER, INNER), (68, 63, 53))
    d = ImageDraw.Draw(image)
    rows = 4 if fine else 3
    height = INNER / rows
    width = 85 if fine else (100 if flag else 116)
    for row in range(rows + 1):
        offset = -(width / 2) if row % 2 else 0
        for col in range(-1, 4):
            x = int(offset + col * width)
            y = int(row * height)
            shift = rng.randint(-10, 10)
            base = ((103, 105, 100) if dark else (126, 124, 113))
            color = tuple(c + shift for c in base)
            box = (x + 3, y + 3, x + width - 2, y + height - 2)
            d.rounded_rectangle(box, radius=5, fill=color)
            d.line([(box[0]+4, box[3]-2), (box[0]+2, box[1]+3), (box[2]-4, box[1]+2)],
                   fill=tuple(min(255, c + 24) for c in color), width=2)
            d.line([(box[2]-2, box[1]+5), (box[2]-2, box[3]-2), (box[0]+5, box[3]-2)],
                   fill=tuple(max(0, c - 27) for c in color), width=2)
            for _ in range(30):
                px, py = rng.randint(x+7, x+width-8), rng.randint(y+8, y+int(height)-9)
                tone = rng.choice((-16, -9, 12, 19))
                d.line((px, py, px+rng.randint(1, 6), py+rng.randint(-2, 2)),
                       fill=tuple(max(0, min(255, c+tone)) for c in color), width=1)
    return noisy(image, seed, 11)


def timber(seed, planks=True):
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:INNER, 0:INNER]
    warp = x + 3*np.sin(y/22) + 2*np.sin(y/9+x/29)
    knots = np.sqrt(((x-63)/1.5)**2 + ((y-145)/3)**2)
    grain = 6*np.sin(warp*0.45) + 4*np.sin(warp*1.3 + y*.05)
    grain += 7*np.sin(knots*.8) * np.exp(-((x-63)**2+(y-145)**2)/3600)
    grain += rng.normal(0, 3, (INNER, INNER))
    seams = np.minimum(x % 48, 48-x % 48) if planks else np.full_like(x, 99)
    shade = np.where(seams < 2, -37, np.where(seams < 4, 12, 0))
    data = np.stack([92+grain+shade, 57+grain*.70+shade*.65, 31+grain*.40+shade*.4], axis=-1)
    return Image.fromarray(np.clip(data, 0, 255).astype(np.uint8)).convert("RGBA")


def door(seed, magazine=False, gate=False):
    image = ashlar(seed)
    d = ImageDraw.Draw(image)
    d.rounded_rectangle((35, 18, 205, 240), radius=27, fill=(60, 57, 47), outline=(156, 148, 126), width=8)
    wood = timber(seed+4).resize((138, 207))
    image.paste(wood, (51, 33))
    d = ImageDraw.Draw(image)
    if gate:
        for x in range(57, 189, 22):
            d.rectangle((x, 29, x+6, 240), fill=(47, 46, 41))
        for y in range(64, 240, 42):
            d.rectangle((50, y, 190, y+6), fill=(47, 46, 41))
    else:
        for y in (68, 176):
            d.rectangle((51, y, 189, y+12), fill=(48, 49, 45), outline=(79, 78, 68), width=2)
            for x in range(58, 184, 24):
                d.ellipse((x, y+3, x+5, y+8), fill=(22, 23, 22))
        d.ellipse((159, 111, 174, 132), outline=(163, 134, 75), width=3)
    if magazine:
        d.rectangle((98, 39, 142, 72), fill=(104, 41, 28), outline=(161, 137, 86), width=2)
        d.ellipse((112, 46, 128, 62), fill=(180, 151, 91))
    return image


def roof(seed):
    rng = random.Random(seed)
    image = Image.new("RGBA", (INNER, INNER), (71, 36, 27, 255))
    d = ImageDraw.Draw(image)
    for row in reversed(range(-1, 9)):
        for col in range(-1, 9):
            x, y = col*34 + (row % 2)*17, row*30
            shift = rng.randint(-15, 14)
            color = (153+shift, 65+shift//2, 43+shift//3)
            d.rounded_rectangle((x+1, y-8, x+33, y+31), radius=11, fill=(66, 35, 27))
            d.rounded_rectangle((x+3, y-8, x+31, y+27), radius=9, fill=color)
            d.arc((x+4, y+8, x+30, y+26), 0, 180, fill=(191+shift, 101+shift//2, 65), width=2)
            d.line((x+7, y-2, x+7, y+14), fill=(175+shift, 84+shift//2, 54), width=2)
    return noisy(image, seed, 4)


def window(image, seed):
    d = ImageDraw.Draw(image)
    d.rounded_rectangle((78, 34, 162, 215), radius=27, fill=(155, 143, 113), outline=(57, 56, 47), width=4)
    d.rounded_rectangle((92, 48, 148, 199), radius=18, fill=(35, 48, 50))
    d.rectangle((97, 69, 143, 194), fill=(52, 80, 96))
    d.polygon([(100, 76), (139, 76), (100, 147)], fill=(85, 116, 132))
    d.line((120, 51, 120, 199), fill=(177, 167, 133), width=5)
    d.line((92, 124, 148, 124), fill=(177, 167, 133), width=5)
    d.line((79, 211, 161, 211), fill=(188, 175, 141), width=5)
    rng = random.Random(seed)
    for origin in (15, 213):
        points = [(origin+int(9*math.sin(t*.6)), 239-t*9) for t in range(20)]
        d.line(points, fill=(59, 69, 35), width=3)
        for x, y in points:
            dx = rng.choice([-6, 4])
            d.ellipse((x+dx-3, y-3, x+dx+4, y+3), fill=rng.choice([(73, 88, 45),(95, 106, 53),(52, 72, 40)]))
    return image


def face(key, kind, seed):
    top, bottom, front = kind == 2, kind == 3, kind == 1
    if key in ("ladder", "door") or (key == "floor" and bottom):
        return door(seed) if key == "door" else timber(seed)
    if key == "roof":
        return timber(seed) if bottom else roof(seed)
    if key == "wood":
        image = ashlar(seed, fine=True)
        wood = timber(seed+13)
        d = ImageDraw.Draw(image)
        for box in [(0,0,23,240), (216,0,240,240), (0,0,240,23), (0,215,240,240), (108,0,131,240)]:
            image.paste(wood.crop(box), box[:2])
        d.line((23, 213, 107, 24), fill=(65, 39, 22), width=15)
        d.line((132, 24, 215, 214), fill=(65, 39, 22), width=15)
        return image
    if key in ("gate", "magazine") and front:
        return door(seed, magazine=key == "magazine", gate=key == "gate")
    image = ashlar(seed, dark=key in ("foundation", "mount"), flag=top, fine=key == "palace")
    d = ImageDraw.Draw(image)
    if key == "tower" and not (top or bottom):
        d.rectangle((0, 43, 240, 73), fill=(118, 78, 43), outline=(61, 48, 32), width=3)
        d.line((0, 47, 240, 47), fill=(163, 118, 67), width=3)
        for x in range(13, 240, 49):
            d.rectangle((x, 73, x+13, 85), fill=(89, 63, 39))
    if key == "palace" and not (top or bottom):
        d.rectangle((0, 0, 240, 16), fill=(125, 107, 72))
        d.line((0, 18, 240, 18), fill=(178, 158, 114), width=3)
        image = window(image, seed)
    if key == "air":
        image = Image.new("RGBA", (INNER, INNER), (161, 191, 207, 0))
    return image


def damage(image, state, seed):
    if not state:
        return image
    rng = random.Random(seed)
    data = np.asarray(image).copy()
    data[:, :, :3] = (data[:, :, :3].astype(float) * (1-state*.025)).astype(np.uint8)
    image = Image.fromarray(data)
    d = ImageDraw.Draw(image)
    for i in range(state*2):
        x, y = rng.randint(30, 210), rng.randint(0, 70)
        path = [(x,y)]
        for _ in range(7+state*2):
            x += rng.randint(-19, 19)
            y += rng.randint(9, 21)
            path.append((x,y))
        d.line([(x+2,y+1) for x,y in path], fill=(160, 148, 115), width=2)
        d.line(path, fill=(37, 35, 30), width=state+1)
        p = path[len(path)//2]
        d.line((p, (p[0]+rng.choice([-1,1])*29, p[1]-15), (p[0]+42,p[1]-32)), fill=(43, 40, 32), width=2)
    for _ in range(state*3):
        x, y = rng.randint(0, 239), rng.randint(0, 239)
        d.polygon([(x,y), (x+10,y-3), (x+17,y+6), (x+3,y+10)], fill=(81, 75, 61))
    return image


def padded(image):
    array = np.asarray(image)
    return Image.fromarray(np.pad(array, ((8,8),(8,8),(0,0)), mode="edge"))


def make_cannon(path):
    atlas = Image.new("RGBA", (512,512))
    wood = padded(timber(901, planks=False))
    yy, xx = np.mgrid[0:240, 0:240]
    rng = np.random.default_rng(902)
    noise = rng.normal(0, 3, (240,240)) + 3*np.sin(xx*.06+yy*.03)
    iron = np.stack([53+noise, 53+noise, 51+noise*.9], axis=-1)
    metal = Image.fromarray(np.clip(iron,0,255).astype(np.uint8)).convert("RGBA")
    d = ImageDraw.Draw(metal)
    for n in range(36):
        x, y = (n*67)%239, (n*41)%239
        d.line((x,y,x+13,y+1), fill=(70,68,60), width=1)
    end = Image.new("RGBA", (240,240), (91,59,32,255))
    d = ImageDraw.Draw(end)
    for r in range(8,200,7):
        d.ellipse((108-r,130-r,108+r,130+r), outline=(63+r%23,40+r%16,23+r%9), width=2)
    bore = noisy(Image.new("RGB",(240,240),(21,23,22)), 903, 1)
    # UV origin is bottom-left: wood/iron on the first (bottom) row.
    for i,tile in enumerate([wood,padded(metal),padded(end),padded(bore)]):
        atlas.paste(tile,((i%2)*256,256-(i//2)*256))
    atlas.save(path)


def make_person(path):
    colors = [(139,48,35),(202,161,113),(65,48,36),(53,46,38),(164,130,57),(88,71,49),(167,143,94),(47,54,57)]
    image = Image.new("RGBA",(256,256))
    for i,c in enumerate(colors):
        tile = noisy(Image.new("RGB",(64,128),c),1200+i,2)
        image.paste(tile,((i%4)*64,128-(i//4)*128))
    image.save(path)


def generate(output):
    output = output.resolve()
    root = Path(__file__).resolve().parents[2]
    if output != root / "assets/kit-v1":
        raise ValueError("Only assets/kit-v1 is an allowed authored destination")
    output.mkdir(parents=True,exist_ok=True)
    (output / "textures").mkdir(exist_ok=True)
    atlas = Image.new("RGBA",(4096,4096),(101,98,87,255))
    for block_id,key in enumerate(KEYS):
        intact = [face(key,kind,100+block_id*7+kind) for kind in range(4)]
        for state in range(4):
            strip = Image.new("RGBA",(1024,256))
            for kind in range(4):
                tile = padded(damage(intact[kind].copy(),state,1800+block_id*7+kind))
                index = (block_id*4+state)*4+kind
                atlas.paste(tile,((index%16)*256,4096-(index//16+1)*256))
                strip.paste(tile,(kind*256,0))
            name = key + (f"_z{state}" if state else "")
            strip.save(output / "textures" / f"{name}.png", optimize=True)
    atlas.save(output / "atlas.png",optimize=True)
    make_cannon(output / "cannon-atlas.png")
    make_person(output / "person-atlas.png")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output",type=Path)
    generate(parser.parse_args().output)
