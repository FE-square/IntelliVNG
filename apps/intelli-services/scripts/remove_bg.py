#!/usr/bin/env python3
"""
图片背景去除服务
使用 rembg 库去除图片背景，输出透明PNG
"""

import sys
import io
import base64
from PIL import Image
import requests

try:
    from rembg import remove
except ImportError:
    print("ERROR: rembg not installed. Please run: pip install rembg", file=sys.stderr)
    sys.exit(1)


def remove_background_from_url(image_url: str) -> str:
    """
    从URL下载图片并去除背景
    
    Args:
        image_url: 图片URL
        
    Returns:
        base64编码的PNG图片数据
    """
    try:
        # 下载图片
        response = requests.get(image_url, timeout=30)
        response.raise_for_status()
        
        # 打开图片
        input_image = Image.open(io.BytesIO(response.content))
        
        # 去除背景
        output_image = remove(input_image)
        
        # 转换为PNG bytes
        output_bytes = io.BytesIO()
        output_image.save(output_bytes, format='PNG')
        output_bytes.seek(0)
        
        # 返回base64编码
        return base64.b64encode(output_bytes.getvalue()).decode('utf-8')
        
    except Exception as e:
        print(f"ERROR: Failed to remove background: {str(e)}", file=sys.stderr)
        raise


def remove_background_from_base64(image_base64: str) -> str:
    """
    从base64字符串读取图片并去除背景
    
    Args:
        image_base64: base64编码的图片
        
    Returns:
        base64编码的PNG图片数据
    """
    try:
        # 解码base64
        image_bytes = base64.b64decode(image_base64)
        
        # 打开图片
        input_image = Image.open(io.BytesIO(image_bytes))
        
        # 去除背景
        output_image = remove(input_image)
        
        # 转换为PNG bytes
        output_bytes = io.BytesIO()
        output_image.save(output_bytes, format='PNG')
        output_bytes.seek(0)
        
        # 返回base64编码
        return base64.b64encode(output_bytes.getvalue()).decode('utf-8')
        
    except Exception as e:
        print(f"ERROR: Failed to remove background: {str(e)}", file=sys.stderr)
        raise


if __name__ == '__main__':
    import json
    
    # 从stdin读取JSON输入
    try:
        input_data = json.loads(sys.stdin.read())
        
        if 'url' in input_data:
            # 处理URL
            result = remove_background_from_url(input_data['url'])
        elif 'base64' in input_data:
            # 处理base64
            result = remove_background_from_base64(input_data['base64'])
        else:
            print("ERROR: Missing 'url' or 'base64' in input", file=sys.stderr)
            sys.exit(1)
        
        # 输出结果
        print(json.dumps({
            'success': True,
            'data': result
        }))
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)
