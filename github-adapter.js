'use strict'


const	docloop				=	require('docloop'), 
		EventQueue			= 	docloop.EventQueue,
		DocloopAdapter		=	docloop.DocloopAdapter,
		DocloopError		=	docloop.DocloopError,
		catchAsyncErrors	= 	docloop.catchAsyncErrors,
		errorHandler		= 	docloop.errorHandler,
		GithubTarget		=	require('./github-target.js'),
		GithubApp			=	require('./github-app.js'),
		GithubUser			=	require('./github-user.js'),
		fs					=	require('fs'),
		request				=	require('request-promise-native'),
		Promise				=	require('bluebird')


//TODO: description! TODO: throw Errors when misconfigured.
//
/**
 * 
 * @module  githubAdapter
 * @license GPL-3.0
 * 
 */



/**
 * Adapter to post issues and comments on github
 * TODO: description
 * TODO: eventque details
 * TODO: Defaults
 * TODO: typedefs for params and proerties.
 *
 * The following arguments and properties are on top of the arguments and properties of {@link DocloopAdapter}.
 *
 * @alias		GithubAdapter
 * @memberof  	module:githubAdapter 
 * 
 * @extends 	DocloopAdapter
 *
 * @param		{DocloopCore}			 core
 * @param 		{Object}				 config
 * @param		{String}				 config.appId					GithubApp Id.
 * @param		{String}				[config.appPrivateKey]			GithubApp private. If not provided config.appPrivateKeyLocation is required.
 * @param		{String}				[config.appPrivateKeyLocation]	GithubApp private key location. Can only be omitted if config.appPrivateKey is present.
 * @param		{Object}				[eventQueue]					EventQueue config. See {@link EventQueue}.
 * @param		{Object}				 config.oAuth					Data to authorize GithubApp. Sets .oAuth property.
 * @param		{Object}				 config.dummy					Sets dummy property.
 * 
 * @property 	{String} 				endpointDefaultConfig.label 	Name of the label to tag a new issue with
 * @property	{GithubUser}			githubUser						API wrapper for github user interaction
 * @property	{GithubApp}				githubApp						API wrapper for github app interaction
 * @property	{Collection}			events							Mongo-db collection for stored events
 * @property	{EventQueue}			eventQueue						The event queue the event is stored in
 * @property	{Object}				oAuth							OAuth credentials has provided.
 * @property	{String}				oAuth.clientSecret
 * @property	{String}				oAuth.accessTokenUrl			Url to retrieve an access token from after github posted to Callback (See: GithubApps) 
 * @property	{String}				oAuth.authUrl					Url to open for the user to enter credentials.
 * @property 	{Object} 				dummy							Content of the dummy issue created when a comment is missing its parent issue.
 * @property 	{Object} 				dummy.title						Title of the dummy issue.							
 * @property 	{Object} 				dummy.body						Body of the dummy issze.							
 */
class GithubAdapter extends DocloopAdapter{

	constructor(core, config) {

		if(!config) throw ReferenceError('GitHubAdapter.constructor(): missing config')

		super(core, { 

			...config, 

			id: 					'github',
			type:					'target',
			endpointClass:			GithubTarget,
			extraEndpoints:			false,
			endpointDefaultConfig:	{
										label: 	'docloop',
									},
			help:					`If this adapter won't detect all your repositories, please make sure you installed the docloop GithubApp and gave it access to the repositories you would like to add here.

									You can install and configure the GithubApp here: ${config.app.installationLink}`
		} )

		this.githubUser	=	new GithubUser()
		this.githubApp 	= 	new GithubApp({	
								id:   config.app.id,
								cert: config.app.privateKey || fs.readFileSync(config.app.privateKeyLocation)
							})
		this.oAuth		=	config.oAuth

		docloop.serializeCalls(this, [
			'handleQueuedAnnotationEvent',
			'handleQueuedReplyEvent'
		])

		this.core.on('annotation', 		this.queueAnnotationEvent.bind(this)	)
		this.core.on('reply', 			this.queueReplyEvent.bind(this)		)

		this.app.get('/oauth/callback',  catchAsyncErrors(this.handleOAuthCallback.bind(this)) )

		this.ready = 	this.ready
						.then( ()	=> {


							//eventQueue:

							const eventQueueConfigDefault = {
								delay:				[0, 1000, 5000],
								minDelay:			0,
								maxAttempts:		3,
								processInterval:	10*60*1000,
								spread:				100, //Todo , when frist added events are attempted ot once, without spread =/
							}


							this.eventQueue 	= 	new EventQueue({
															collection:	this.core.db.collection(this.id+'_annotationEvents'), 
															...	{
																	...eventQueueConfigDefault,
																	...config.eventQueue
																}
														}) 

							this.eventQueue.on('annotation-fail', 		queued_event 	=> this.logAnnotationFailedEvent(queued_event) )
							this.eventQueue.on('annotation-done', 		queued_event 	=> this.logAnnotationDoneEvent(queued_event) )
							this.eventQueue.on('annotation-attempt', 	queued_event 	=> this.handleQueuedAnnotationEvent(queued_event) ) 

							// this.eventQueue.on('reply-fail', 			queued_event 	=> this.logReplyFailedEvent(reply) )
							// this.eventQueue.on('reply-done', 			queued_event 	=> this.logReplyDoneEvent(reply) )

							this.eventQueue.on('reply-attempt', 		queued_event 	=> this.handleQueuedReplyEvent(queued_event) ) 

						})

		//TODO:Add config to targets

		//TODO: default config and config Error

		//TODO: this.eventQueue.on('fail', this.handleNewAnnotationEvent.bind(this))


		//TODO catch logout event!

		/* PLAN: Immer wenn User graucht wird auf login umleiten und aufgabe stacken, dann wenn der code und schließlich der token da ist, stack abarbeiten */
	
		//Api-calls mit demselben token stacken
		
		//throw user token away, if need be
	
		//TODO: separate meta data form target/sources

		//TODO: stack api calls 


		//TODO: rename controller for routes

		//TODO: add label to issues, no need for title addon

		//TODO: multipage!

		//TODO: check performacnce /how many api call at once?


	}

	/**
	 * Add an annotation event to the event queue
	 * 
	 * @param  {Annotation}			Annotation from an annotation event
	 * 
	 * @return {undefined}
	 */
	queueAnnotationEvent(event){

		//check if event was relayed to this adapter, if not, ignore it:
		if(!event) 					return null 
		if(!event.target)			return null //maybe log error?
		if(!event.target.id)		return null //maybe log error?
		if(!event.target.adapter)	return null //maybe log error?

		if(event.target.adapter == this.id) this.eventQueue.add('annotation', event)
	}

	/**
	 * Add an reply event to the event queue
	 * 
	 * @param  {Reply}			Reply from an reply event#
	 * 
	 * @return {undefined}			
	 */
	queueReplyEvent(event){

		//check if event was relayed to this adapter, if not, ignore it:
		if(!event) 					return null 
		if(!event.target)			return null //maybe log error?
		if(!event.target.id)		return null //maybe log error?
		if(!event.target.adapter)	return null //maybe log error?

		if(event.target.adapter == this.id) this.eventQueue.add('reply', event)
	}


	/**
	 * Handle request sent by github after successful authorization. 
	 * Uses the app config data and posted code to gain access token from github and store it in session data for later use.
	 * If successful redirects back to the configured front end url.
	 *
	 * @route	{GET}	/adapters/github/oauth/callback
	 * 
	 * @async
	 * 
	 * @param  {Object}	req		Express request object			
	 * @param  {Object}	res		Express result object
	 * 
	 * @throws {DocloopError} 	If not successful
	 * 
	 * @return undefined
	 */
	async handleOAuthCallback(req, res){

		var session_data	=	this._clearSessionData(req.session),
			json 			= 	{
									client_id: 		this.oAuth.clientId,
									client_secret: 	this.oAuth.clientSecret,
									code: 			req.query.code
								},
			uri				=	this.oAuth.accessTokenUrl,

			data			=	await request( {method: 'post', uri, json} )
			
		if(data && data.access_token){
			session_data.access_token = data.access_token
			res.redirect(this.core.config.clientUrl)
		} else{
			throw new DocloopError("GithubAdapter.handleOAuthCallback: unable to get access token", 403)
		}
	}

	/**
	 * @Get authorization state.
	 * @async
	 * @param  {session_data}
	 * @return {AuthState}
	 */
	async getAuthState(session_data){

		var user 			= undefined,
			url				= this.oAuth.authUrl,
			access_token 	= session_data && session_data.access_token

		try {		
			user = await this.githubUser.get(access_token)	
		} 
		catch(e) {	
			user = undefined
			//it's alright if this doesn't work, worst case: we dont get a user name, but then that is exactly what this method is supposed to report. 	
		}

		return {user: user && user.login, url}
	}

	/**
	 * Get all Github repositories for the user authorized for with the access token in session data.
	 * @async
	 * @param  {SessionData}		
	 * @return {Object[]}		
	 */
	async getUserRepos(session_data){

		if(!session_data)				throw new ReferenceError("GithubAdapter.getUserRepos() missing session data")
		if(!session_data.access_token)	throw new DocloopError("GithubAdapter.getUserRepos() missing session data", 403)

		return 	Promise.map(
					this.githubUser.getInstallations(session_data.access_token),
					installation_id => this.githubApp.getRepositories(installation_id)
				)		
				.then(repository_arrays => Array.prototype.concat.apply([], repository_arrays))

	}

	/**
	 * @inheritDoc
	 */
	async getEndpoints(session_data){

		var repos = await this.getUserRepos(session_data)

		return 	repos.map( repo => GithubTarget.fromRepo(this, repo) )
	} 	


	//return only endpoints the user has acces to!
	//TODO: add decor separately

	/**
	 * @inheritDoc
	 */
	async getStoredEndpoints(session_data){

		var valid_endpoints				= await this.getEndpoints(session_data)

		if(valid_endpoints.length == 0)	return []

		var	query						= { $or : valid_endpoints.map( endpoint => ({ identifier: endpoint.identifier }) ) },
			stored_endpoint_data_array	= await this.endpoints.find(query).toArray(),
			stored_endpoints			= stored_endpoint_data_array.map( endpoint_data => this.newEndpoint(endpoint_data))

		return stored_endpoints
	}


	async handleQueuedAnnotationEvent(queued_event){

		//Todo: nur ztum testen:
		var event		= queued_event.event || queued_event,
			annotation	= event.annotation,
			target_id	= event.target.id

		//TODO: check event.link.target.id

		var target	= await this.getStoredEndpoint(target_id)


		await target.handleAnnotation(annotation)

		queued_event.checkOff()

	}


	async handleQueuedReplyEvent(queued_event){

		//Todo: nur ztum testen:
		var event		= queued_event.event || queued_event,
			reply		= event.reply,
			target_id	= event.target.id

		//TODO: check event.link.target.id

		var target	= await this.getStoredEndpoint(target_id)

		try{
			await target.handleReply(reply)
		}
		catch(e){
			console.error(e)
		}
		queued_event.checkOff()

	}


	//TODO
	async logAnnotationFailedEvent(queued_event){
		//console.log('this event failed', queued_event)
		return queued_event
	}

	async logAnnotationDoneEvent(queued_event){
		//console.log('this event was settled', queued_event)
		return queued_event
	}


}


module.exports = {GithubAdapter, GithubTarget, GithubUser, GithubApp}



	
