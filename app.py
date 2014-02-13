#!/usr/bin/env python
# -*- coding: utf-8 -*-

from torext.app import TorextApp
import settings


app = TorextApp(settings)


import subprocess
import random
import string
import json
from torext.handlers import BaseHandler as _BaseHandler
from pi_router.zipdb import ZipDB


db = ZipDB()


def get_mac(ip):
    p = subprocess.Popen(['arp', '-n', ip], stdout=subprocess.PIPE)
    out, _ = p.communicate()
    try:
        mac = out.split('\n')[1].split()[2]
    except IndexError:
        import uuid
        mac = str(uuid.getnode())
    return mac


class BaseHandler(_BaseHandler):
    PREPARES = ['user']

    def _get_key(self, *args):
        return '|'.join(args)

    def get_ip_mac(self):
        ip = self.request.headers.get('X-Real-Ip')
        if not ip:
            self.request.headers.get('X-Forwarded-For')
        if not ip:
            ip = self.request.remote_ip

        return ip, get_mac(ip)

    def gen_code(self, ip, mac):
        code = ''.join(random.sample(string.ascii_letters + string.digits, 4))
        key = self._get_key('code', ip, mac)
        db[key] = code
        return code

    def authenticate(self):
        #key = self._get_key('code', ip, mac)
        #return db[key] == code

        ip, mac = self.get_ip_mac()
        return 0

    def prepare_user(self):
        ip, mac = self.get_ip_mac()
        self.user_ip = ip
        self.user_mac = mac
        self.user_identifier = '|'.join([ip, mac])
        self.is_wlan = True
        if ip == '127.0.0.1':
            self.is_wlan = False

        self.is_authenticated = False
        if db[self.user_identifier] == '1':
            self.is_authenticated = True

    def get_ips(self):
        ips = db['ips']
        if ips:
            ips = json.loads(ips)
        else:
            ips = {}
        return ips

    def add_user(self):
        ips = self.get_ips()
        if not self.user_ip in ips:
            ips[self.user_ip] = self.user_mac

        db['ips'] = json.dumps(ips)

    def delete_user(self):
        ips = self.get_ips()
        if self.user_ip in ips:
            del ips[self.user_ip]

        db['ips'] = json.dumps(ips)

    def call(self, cmd):
        print 'call: %s' % cmd
        subprocess.Popen(cmd.split(' '), stdout=subprocess.PIPE, stderr=subprocess.PIPE, stdin=subprocess.PIPE)

    def register(self):
        if self.is_wlan:
            self.call('sudo iptables -t mangle -I internet 1 -m mac --mac-source %s -j RETURN' % self.user_mac)
            self.call('sudo rmtrack %s' % self.user_ip)

        db[self.user_identifier] = '1'
        self.add_user()

    def logout(self):
        if self.is_wlan:
            self.call('sudo iptables -D internet -t mangle -m mac --mac-source %s -j RETURN' % self.user_mac)
            self.call('sudo rmtrack %s' % self.user_ip)

        db[self.user_identifier] = '0'
        self.delete_user()


@app.route('/api/auth')
class AuthHandler(BaseHandler):
    def get(self):
        d = {
            'is_authenticated': self.is_authenticated
        }
        self.write_json(d)

    def post(self):
        if self.get_argument('key'):
            self.register()


@app.route('/api/logout')
class LogoutHandler(BaseHandler):
    def get(self):
        self.logout()


@app.route('/api/ips')
class IPsHandler(BaseHandler):
    def get(self):
        ips = db['ips']
        if ips:
            d = ips
        else:
            d = []
        self.write_json(d)


@app.route('/api/monitor')
class MonitorHandler(BaseHandler):
    def get(self):
        action = self.get_argument('action')
        if action == 'load':
            self.start_p()
        elif action == 'unload':
            self.stop_p()
        else:
            pass

    def start_p(self):
        if not self.is_wlan:
            return

        pid = self.get_p()
        if not pid:
            subprocess.Popen(['sudo', 'sh', '/home/pi/Documents/stream.sh'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            print 'started stream'
            self.get_p()

    def stop_p(self):
        pid = self.get_p()
        if pid:
            print 'kill stream'
            subprocess.call(['sudo', 'kill', pid])

    def get_p(self):
        p = subprocess.Popen(['pgrep', 'mjpg'], stdout=subprocess.PIPE)
        out, _ = p.communicate()
        pid = out.strip()
        print 'pid', pid
        if not pid:
            return None
        return pid


@app.route('/')
@app.route('/(\w+)')
class HomeHandler(BaseHandler):
    def get(self, name=None):
        print 'GET /%s' % name

        self.render('home.html',
                    authenticated=self.authenticate(),
                    ip=self.user_ip,
                    mac=self.user_mac)


if '__main__' == __name__:
    app.command_line_config()
    app.run()
