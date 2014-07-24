$(function(){


	var id = Number(window.location.pathname.match(/\/chat\/(\d+)$/)[1]);

	var socket = io.connect('/socket');

	var name = "",
		friend = "";

	
	var section = $(".section"),
		footer = $("footer"),
		onConnect = $(".connect"),
		inviteSomebody = $(".invite"),
		join = $(".join"),
		chatScreen = $(".chatscreen"),
		left = $(".left");

	var chatName = $(".name-chat"),
		leftName = $(".name-left"),
		loginForm = $(".loginForm"),
		yourName = $("#yourName"),
		hisName = $("#hisName"),
		chatForm = $("#chatform"),
		textarea = $("#message"),
		submit = $("#submit"),
		chats = $(".chats");

	var pc;
	var sendChannel;
	var isInitiator = false;
	var isStarted = false;
	var isChannelReady = false;


	var pc_config = {'iceServers': [{'url': 'stun:stun.l.google.com:19302'}]};

  	var pc_constraints = {
  	'optional': [
  	{'DtlsSrtpKeyAgreement': true},
    {'RtpDataChannels': true}
  	]};

  	var sdpConstraints = {'mandatory': {
  	'OfferToReceiveAudio':false,
  	'OfferToReceiveVideo':false }};


  ////////////////////////////////////////////////

	function sendMessage(message){
		console.log('Sending message: ', message);
  		socket.emit('message', message);
	}

	socket.on('message', function (message){
  		console.log('Received message:', message);
 		if (message.type === 'offer') {
    		if (!isInitiator && !isStarted) {
    			console.log('log in 2')
      			maybeStart();
    		}
    		pc.setRemoteDescription(new RTCSessionDescription(message));
    		doAnswer();
  		} else if (message.type === 'answer' && isStarted) {
    		pc.setRemoteDescription(new RTCSessionDescription(message));
  		} else if (message.type === 'candidate' && isStarted) {
    		var candidate = new RTCIceCandidate({sdpMLineIndex:message.label,
      			candidate:message.candidate});
    			pc.addIceCandidate(candidate);
  		} else if (message === 'bye' && isStarted) {
    		handleRemoteHangup();
  		}
	});


	function maybeStart() {
  		if (!isStarted && isChannelReady) {
    		createPeerConnection();
    		isStarted = true;
    		if (isInitiator) {
      			doCall();
    		}
  		}
	}

//////////////////////////////////////////////////////////////////////////////////////

	function createPeerConnection() {

  		try {
    			pc = new RTCPeerConnection(pc_config, pc_constraints);
    			pc.onicecandidate = handleIceCandidate;
    			console.log('Created RTCPeerConnnection with:\n' +
      			'  config: \'' + JSON.stringify(pc_config) + '\';\n' +
      			'  constraints: \'' + JSON.stringify(pc_constraints) + '\'.');
  		} catch (e) {
    		console.log('Failed to create PeerConnection, exception: ' + e.message);
    		alert('Cannot create RTCPeerConnection object.');
      		return;
  		}

  		if(isInitiator)
  		{
    		try {
      			// Reliable Data Channels not yet supported in Chrome
      			sendChannel = pc.createDataChannel("sendDataChannel", {reliable: false});
      			sendChannel.onmessage = handleMessage;
      			trace('Created send data channel');
    		} catch (e) {

      			alert('Failed to create data channel. ' +
            		'You need Chrome M25 or later with RtpDataChannel enabled');
      			console.log('createDataChannel() failed with exception: ' + e.message);
    		}
    		sendChannel.onopen = handleSendChannelStateChange;
    		sendChannel.onclose = handleSendChannelStateChange;
    	}
    	else
    	{
    		pc.ondatachannel = gotReceiveChannel;	
    	} 
	}

	function gotReceiveChannel(event) {
  		trace('Receive Channel Callback');
  		sendChannel = event.channel;

  		sendChannel.onmessage = handleMessage;
  		sendChannel.onopen = handleReceiveChannelStateChange;
  		sendChannel.onclose = handleReceiveChannelStateChange;
	}

	//Handling the received chat msg

	function handleMessage(event) {
  		trace('Received message: ' + event.data);
  		var received = JSON.parse(event.data);
  		//console.log(received.msg  +  received.user);
  		showMessage('chatStarted');
		createChatMessage(received.msg, received.user);
		scrollToBottom();
	}

	function handleSendChannelStateChange() {
  		var readyState = sendChannel.readyState;
  		trace('Send channel state is: ' + readyState);
  	//	enableMessageInterface(readyState == "open");
	}

	function handleReceiveChannelStateChange() {
  		var readyState = sendChannel.readyState;
  		trace('Receive channel state is: ' + readyState);
  	//	enableMessageInterface(readyState == "open");
	}

	function enableMessageInterface(shouldEnable) {
    	if (shouldEnable) {
    		textarea.disabled = false;
    		textarea.focus();
    		textarea.placeholder = "";
    		submit.disabled = false;
   		} else {
    		textarea.disabled = true;
    		submit.disabled = true;
  		}
	}

	function handleIceCandidate(event) {
  		console.log('handleIceCandidate event: ', event);
  		if (event.candidate) {
    		sendMessage({
      			type: 'candidate',
      			label: event.candidate.sdpMLineIndex,
      			id: event.candidate.sdpMid,
      			candidate: event.candidate.candidate});
  		} else {
    	console.log('End of candidates.');
  		}
	}
	function handleCreateOfferError(event){
  		console.log('createOffer() error: ', e);
	}
	function doCall() {
  	  	console.log('Sending offer to peer');
  	  	var constraints = {'optional': [], 'mandatory': {'MozDontOfferDataChannel': true}};
  		// temporary measure to remove Moz* constraints in Chrome
  		if (webrtcDetectedBrowser === 'chrome') {
    		for (var prop in constraints.mandatory) {
      			if (prop.indexOf('Moz') !== -1) {
        			delete constraints.mandatory[prop];
      			}
     		}
   		}
  		pc.createOffer(setLocalAndSendMessage, handleCreateOfferError,constraints);
	}

	function doAnswer() {
  		console.log('Sending answer to peer.');

  		pc.createAnswer(setLocalAndSendMessage, null, sdpConstraints);
	}

	function setLocalAndSendMessage(sessionDescription) {
  		pc.setLocalDescription(sessionDescription);
  		sendMessage(sessionDescription);
	}

	function handleRemoteHangup() {
  		console.log('Session terminated.');
  		stop();
  		isInitiator = false;
	}

	function stop() {
  		isStarted = false;
  		pc.close();
  		pc = null;
	}
	///////////////////////////////////////////////////////////////////////
	
	socket.on('connect', function(){

		socket.emit('load', id);

	});

	
	socket.on('peopleinchat', function(data){

		if(data.number === 0){

			showMessage("connected");

			loginForm.on('submit', function(e){

				e.preventDefault();

				name = $.trim(yourName.val());
				
				isInitiator = true;

				isChannelReady = true;

				showMessage("inviteSomebody");

				socket.emit('login', {user: name, id: id});
			
			});
		}

		else if(data.number === 1) {

			showMessage("personinchat",data);

			loginForm.on('submit', function(e){
				
				e.preventDefault();
				isChannelReady = true;
				name = $.trim(hisName.val());
				socket.emit('login', {user: name, id: id});
			});
		}

	});

	socket.on('full', function (data){
 		console.log('Room ' + data + ' is full');
	});

	socket.on('startChat', function(data){
		
		if (isInitiator) {
			console.log('log in 1')
			maybeStart();
		}

		if(data.boolean && data.id == id) {
			
			chats.empty();

			if(name === data.users[0]) {

				showMessage("youStartedChatWithNoMessages",data);
			}
			else {

				showMessage("heStartedChatWithNoMessages",data);
			}

			chatName.text(friend);
		}
	});

	socket.on('leave',function(data){

		if(data.boolean && id==data.room){
			sendMessage('bye');
			showMessage("somebodyLeft", data);
			chats.empty();
		}

	});

	textarea.keypress(function(e){

		if(e.which == 13) {
			e.preventDefault();
			chatForm.trigger('submit');
		}

	});

	chatForm.on('submit', function(e){

		e.preventDefault();

		showMessage("chatStarted");

		createChatMessage(textarea.val(), name);
		scrollToBottom();

		var data = textarea.val();
		//trace('sent data' + data);
		
		sendChannel.send(JSON.stringify({"msg": data, "user" : name}));

		textarea.val("");
	});



	function createChatMessage(msg,user){

		var who = '';

		if(user===name) {
			who = 'me';
		}
		else {
			who = 'you';
		}

		var li = $(
			'<li class=' + who + '>'+
			'<div>' +
					'<b></b>' +
			'</div>' +
			'<p></p>' +
			'</li>');

		li.find('p').text(msg);
		li.find('b').text(user);

		chats.append(li);
	}

	function scrollToBottom(){
		$("html, body").animate({ scrollTop: $(document).height()-$(window).height() },1000);
	}

	function showMessage(status,data){

		if(status === "connected"){

			section.children().css('display', 'none');
			onConnect.fadeIn(1200);
		}

		else if(status === "inviteSomebody"){

		
			$("#link").text(window.location.href);

			onConnect.fadeOut(1200, function(){
				inviteSomebody.fadeIn(1200);
			});
		}

		else if(status === "personinchat"){

			onConnect.css("display", "none");
			join.fadeIn(1200);
			chatName.text(data.user);
		}

		else if(status === "youStartedChatWithNoMessages") {

			left.fadeOut(1200, function() {
				inviteSomebody.fadeOut(1200,function(){
		
					footer.fadeIn(1200);
				});
			});

			friend = data.users[1];
		}

		else if(status === "heStartedChatWithNoMessages") {

			join.fadeOut(1200,function(){
				footer.fadeIn(1200);
			});

			friend = data.users[0];
		
		}

		else if(status === "chatStarted"){

			section.children().css('display','none');
			chatScreen.css('display','block');
		}

		else if(status === "somebodyLeft"){

			leftName.text(data.user);

			section.children().css('display','none');
			footer.css('display', 'none');
			left.fadeIn(1200);
		}

	}

});
