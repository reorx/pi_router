#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import StringIO
from wheezy.captcha import image

static_path = os.path.join(os.path.dirname(__file__), 'static')
_resource_path = lambda x: os.path.abspath(os.path.join(static_path, x))


def text_to_image(text):
    image_factory = image.captcha(drawings=[
        image.background(),
        image.text(
            fonts=[
                _resource_path('MSYHBD.TTF'),
                _resource_path('MSYHBD.TTF')
            ],
            drawings=[
                image.warp(),
                image.rotate(),
                image.offset()
            ]
        ),
        image.curve(),
        image.noise(),
        image.smooth()
    ])
    image_obj = image_factory(list(text))
    buf = StringIO.StringIO()
    image_obj.save(buf, 'jpeg', quality=80)
    return buf.getvalue()


if __name__ == '__main__':
    print text_to_image('hello')
