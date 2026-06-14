"""Fit a screenshot to the TV panel and encode it as JPEG.

Center-crop/resize logic adapted from vivalatech's frametv-artchanger
(utils.Utils.resize_and_crop_image), which this add-on reverse-engineers.
"""
from __future__ import annotations

from io import BytesIO

from PIL import Image


def to_panel_jpeg(png_bytes: bytes, target_width: int, target_height: int,
                  quality: int = 90) -> bytes:
    """Resize+center-crop `png_bytes` to exactly target_width x target_height,
    returning JPEG bytes. A capture taken at the panel size is already correct
    and just gets re-encoded; this guards the off-by-a-bit cases."""
    with Image.open(BytesIO(png_bytes)) as img:
        img = img.convert("RGB")
        src_ratio = img.width / img.height
        dst_ratio = target_width / target_height

        if src_ratio > dst_ratio:
            new_height = target_height
            new_width = round(new_height * src_ratio)
        else:
            new_width = target_width
            new_height = round(new_width / src_ratio)

        img = img.resize((new_width, new_height), Image.LANCZOS)

        left = (new_width - target_width) // 2
        top = (new_height - target_height) // 2
        img = img.crop((left, top, left + target_width, top + target_height))

        out = BytesIO()
        img.save(out, format="JPEG", quality=quality)
        return out.getvalue()
