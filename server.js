	var app = require('express')();
	var http = require('http').Server(app);
	var port = process.env.PORT || 8000;
	var io = require('socket.io').listen(app.listen(port));

	console.log('connected');

	var express = require('express');
	var usernames = [];
	app.set('view engine', 'html');
	app.engine('html', require('ejs').renderFile);
	app.set('views', __dirname + '/views');
	app.use(express.static(__dirname + '/public'));


	app.get('/', function(req, res){
  		//res.render('home');
  		var id = Math.round((Math.random() * 100000));
  		res.redirect('/chat/'+id);
	});

	app.get('/chat/:id', function(req,res){
		res.render('home');
	});

	var chat = io.of('/socket').on('connection', function (socket) {

		socket.on('load',function(data){

			if(count(chat.adapter.rooms[data]) === 0 ) {

				socket.emit('peopleinchat', {number: 0});
			}
			else if(count(chat.adapter.rooms[data]) === 1) {
				console.log(usernames[0]);

				socket.emit('peopleinchat', {
					number: 1,
					user: usernames[0],
					id: data
				});
			}
			else{
				socket.emit('full',id);
			}
		});


		//relaying msg 
		socket.on('message', function (message) {
			
			socket.broadcast.emit('message', message); 
		});
		
		socket.on('login', function(data) {

			if(count(chat.adapter.rooms[data.id]) < 2){

				socket.username = data.user;
				socket.room = data.id;
				usernames.push(data.user);
				console.log(usernames);
				socket.join(data.id);

				if(count(chat.adapter.rooms[data.id]) == 2) {

					chat.in(data.id).emit('startChat', {
						boolean: true,
						id: data.id,
						users: usernames
					});
				}

			}
		});

		socket.on('disconnect', function() {

		
			socket.broadcast.to(this.room).emit('leave', {
				boolean: true,
				room: this.room,
				user: this.username,
			});

			socket.leave(socket.room);
		});
		
	});
	function count(data)
	{
		countId = 0;
		if(data)
		{
			for(var id in data)
				countId++;
		}
		return countId;
	}

