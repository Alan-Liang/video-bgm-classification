Video BGM Classification GUI
============================

## How to deploy
Linux is the first-class operating system while deployments on other OSs may be possible.

Our dependencies:

- Node v12.x or latest active LTS
- (*Windows Only*) Visual Studio build tools (for compiling TensorFlow bindings)
- NPM dependencies; see the `dependencies` section in `package.json`
- Python 3.x
- Python dependencies; see `requirements.txt`
- Git
- Nginx (*optional*; for reverse proxying the server)
- Certbot (*optional*; for Let's Encrypt certificates)

Here is a deploy script for your convenience.

**Install dependencies**:
```shell
curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
sudo apt install -y software-properties-common
sudo add-apt-repository ppa:certbot/certbot
sudo apt install git nodejs python3 python3-pip ffmpeg libsndfile1-dev screen nginx python-certbot-nginx
git clone https://github.com/Alan-Liang/music-gui.git --depth 1
cd music-gui
npm i
sudo -H pip3 install -r requirements.txt
```

**Get model weights**:
Get the weights files at the [releases page](https://github.com/Alan-Liang/music-gui/releases) and execute:
```shell
tar zxf model.tar.gz
```

**Configure the server**:
```shell
cp sample.env .env
nano .env
```

**Start the server**:
```shell
npm start
```

**Configure nginx** (*optional*): write the following content to `/etc/nginx/sites-available/default`, then run `sudo nginx -s reload`
```
server {
	listen 80 default_server;
	listen [::]:80 default_server;
	server_name _;
	location / {
		proxy_pass http://localhost:8080;
	}
}
```

**Configure Certbot** (*optional*):
```shell
sudo certbot --nginx -d your.domain.tld
sudo nginx -s reload
```

**All Done!**

## License

AGPLv3

