'use strict'

const	DocloopEndpoint	=	require('docloop').DocloopEndpoint,
		Promise			=	require('bluebird')

/**
 *Class representing the Github issue tracker.
 *
 * @memberof	module:githubAdapter
 *
 * @extends		DocloopEndpoint
 *
 * @throws		{TODO}					TODO
 * 
 */
class GithubTarget extends DocloopEndpoint{

	constructor(adapter, {id, _id, identifier, config, decor, data}){

		//TODO: this should never happen, should it?
		if(arguments[1] instanceof GithubTarget) return arguments[1]

		super(adapter, {
			id,
			_id, 
			identifier, 
			config, 
			data,
			decor: 		decor || {
								image:		null,
								title:		'Github Repository',
								details:	'unknown'
						}, 
		})		

		if(!identifier.repo)					throw new ReferenceError("GithubTarget.constructor() missing identifier.repo")
		if(!identifier.installation_id)			throw new ReferenceError("GithubTarget.constructor() missing identifier.installation_id")
		if(!identifier.owner)					throw new ReferenceError("GithubTarget.constructor() missing identifier.owner")							
		
		if(adapter.id != identifier.adapter)	throw new Error("GithubTarget.constructor() adapter mismatch")							
	}


	/**
	 * Creates a new Endpoint from a set of repository data,
	 * 
	 * @static
	 * 
	 * @param  {Adapter}	adapter
	 * @param  {Object}		repo		Repository data
	 * @return {Endpoint}
	 */
	static fromRepo(adapter, repo){
		if(!repo)								throw new ReferenceError("GithubTarget.fromRepo() missing repo")
		if(!repo.name)							throw new ReferenceError("GithubTarget.fromRepo() missing repo.name")
		if(!repo.installation_id)				throw new ReferenceError("GithubTarget.fromRepo() missing repo.installation_id")
		if(!repo.owner)							throw new ReferenceError("GithubTarget.fromRepo() missing repo.owner")
		if(!repo.owner.login)					throw new ReferenceError("GithubTarget.fromRepo() missing repo.owner.login")

		var identifier = 	{
								adapter:			adapter.id, 
								repo:				repo.name,
								installation_id:	repo.installation_id,
								owner:				repo.owner.login
							},
			decor		=	GithubTarget.repoToDecor(repo)	

		return new GithubTarget(adapter, {identifier, decor})
	}

	/**
	 * Extract decoration data from repositpry data.
	 *
	 * @static
	 * @param  {Object}		repo		Repository data
	 * @return {Decoration}
	 */
	static repoToDecor(repo){
		return {
			image: 				repo.owner.avatar_url,
			title:				repo.name,
			details:			repo.owner.login
		}
	}


	/**
	 * Check if the current session has access to the repository the endpoint's identifier points to.
	 *
	 * @async
	 * @param  	{SessionData}			session_data
	 * @return 	{undefined}
	 *
	 * @throws	{DocloopError|403}						If current session cannot access the repository
	 */
	async validate(session_data){
		var valid_endpoints	= await this.adapter.getEndpoints(session_data),
			match			= 		valid_endpoints.some( endpoint => this.match(endpoint) )

		if(!match)	throw new DocloopError('GithubTarget.validate() no valid endpoint match', 403)
	}


	/**
	 * TODO: Rethink decoration
	 * 
	 * @param  {SessionData}
	 * @return {undefined}
	 *
	 * @throws	{TODO}				If TODO
	 */
	async updateDecor(session_data){
		var valid_endpoints	= await this.adapter.getEndpoints(session_data)
		
		valid_endpoints.forEach( endpoint => {
			if(this.match(endpoint)) this.decor = endpoint.decor
		})
	}


	/**
	 * Set of data representing a github issue
	 * 
	 * @typedef {Issue}
	 * @param 	{String} 	title
	 * @param 	{String} 	body
	 * @param	{String[]}	?labels		List of label names
	 * @param 	{String} 	?number		Issue number
	 */

	/**
	 * Turn an {@link Annotation} into isuue data ready to be posted to the github API.
	 * 
	 * @param  {Annotation}	annotation
	 * @return {Issue}					
	 */
	annotation2Issue(annotation){
		var title 				= 	annotation.title + ' [via '+annotation.sourceName+'@'+this.adapter.core.config.name+']',
			import_line			=	'_Annotation imported from <a href ="'+annotation.sourceHome+'">'+annotation.sourceName+'</a>._'+'\n\n',
			target_block		=	annotation.respectiveContent
									?	  'Regarding this part:\n'
										+ '<blockquote>'
										+ annotation.respectiveContent
										+ '</blockquote>\n\n'
									:	'',
			annotation_block	=	  annotation.author+' wrote:'+'\n'
									+ '<blockquote>\n'
									+ annotation.body+'\n'
									+ '</blockquote>'+'\n\n',
			footer_line			=	'_Link to <a href = "'+annotation.original+'">orginial comment</a>. About <a href ="'+this.adapter.core.config.home+'">docLoop</a>._',
			
			body				=	  import_line 
									+ target_block 
									+ annotation_block
									+ footer_line,

			labels				=	this.config.label && [this.config.label]


		return {title, body, labels}
	}



	/**
	 * Handle annotation event. Update or create a corresponding issue on Github.
	 *
	 * @param  	{Annotation}	annotation
	 * @return 	{undefined}
	 *
	 * @throws	{TODO}							If TODO
	 */
	async handleAnnotation(annotation){

		var issue_number 	= 	await this.getIssueNumber(annotation.id),
			issue			= 	{
									...this.annotation2Issue(annotation),
									number: issue_number
							 	}


		issue_number		=	await this.adapter.githubApp.createOrUpdateIssue(this.identifier, issue)


		await 	this.storeIssueNumber(annotation.id, issue_number)
	}


	/**
	 * Stores connection between an annotation and an issue number. This serves two purposes:
	 * If the same annotation event fires again the same issue will be updated/overwritten.
	 * If a reply event fires, a comment can be placed into the corresponding issue.
	 *
	 * @async
	 * 
	 * @param  	{String}		annotation_id		Id from the original source.
	 * @param  	{String}		issue_number		Github issue number
	 * @return 	{undefined}
	 *
	 * @throws 	{TODO}								If TODO
	 */
	async storeIssueNumber(annotation_id, issue_number){
		return	this.setData('issueMap.'+annotation_id, issue_number)
	}


	/**
	 * Get a stored issue number correspoding to an annotation id.
	 *
	 * @async
	 * 
	 * @param  	{annotation_id}					Id from the original source.
	 * @return 	{String}						Corresponding issue number
	 *
	 * @throws	{TODO}							If TODO
	 */
	async getIssueNumber(annotation_id){
		return 	await this.getData('issueMap.'+annotation_id)
	}


	/**
	 * Makes sure there is an issue corresponding to the provided annotation id. 
	 * If there is no such issue existing yet, then create a dummy issue and return its issue number.
	 * This is useful if a reply event fires before its parent annotation event. 
	 * This can happen if the annotation is old and has never been imported or the import has been delayed for some reason.
	 *
	 * @async
	 * @param  {String}		annotation_id		Id from the original source
	 * @return {String}							Github issue number
	 * @throws {TODO} 							If TODO
	 */
	async ensureIssueNumber(annotation_id){


		var issue_number	=		await 	this.getIssueNumber(annotation_id)
								||	await 	this.adapter.githubApp.createOrUpdateIssue(
												this.identifier,
												{ 
													title: 	this.adapter.config.dummy.title, 
													body: 	this.adapter.config.body,

												}
											)

		await this.storeIssueNumber(annotation_id, issue_number)


		return issue_number
	}


	/**
	 * Set of data representing a github comment.
	 * 
	 * @typedef {Comment}
	 * @param 	{String} 	body
	 * @param	{String}	!number	Github issue number
	 * @param 	{String} 	?id		Comment id
	 */


	/**
	 * Turn an {@link Reply} into comment data ready to be posted to the github API.
	 * 
	 * @param  {Reply}		reply
	 * @return {Object}					Comment data
	 */
	reply2Comment(reply){
		return 	{ body:	this.annotation2Issue(reply).body }
	}


	/**
	 * Handle reply event. Update or create a corresponding comment on Github.
	 *
	 * @param  	{Reply}		reply
	 * @return 	{undefined}
	 *
	 * @throws	{TODO}					If TODO
	 */
	async handleReply(reply){

		console.log('parentId', reply.parentId)

		var issue_number 	= 	await this.ensureIssueNumber(reply.parentId),
			comment			= 	{
									...this.reply2Comment(reply),
									id:		await this.getCommentId(reply.id),
									number: issue_number
							 	},
			comment_id		=	await this.adapter.githubApp.createOrUpdateComment(this.identifier, comment)

		await this.storeCommentId(reply.id, comment_id)
	}


	/**
	 * Stores connection between an reply and a coment number. 
	 * If the same reply event fires again the correspondin comment will be updated/overwritten.
	 *
	 * @async
	 * 
	 * @param  	{String}		reply_id			Reply id from the original source.
	 * @param  	{String}		comment_id			Github comment_id
	 * @return 	{undefined}
	 *
	 * @throws 	{TODO}								If TODO
	 */
	
	async storeCommentId(reply_id, comment_id){
		return	this.setData('commentMap.'+reply_id, comment_id)
	}


	/**
	 * Get a stored comment id correspoding to a reply id.
	 *
	 * @async
	 * 
	 * @param  	{reply_id}						Reply Id from the original source.
	 * @return 	{String}						Corresponding comment id
	 *
	 * @throws	{TODO}							If TODO
	 */
	async getCommentId(reply_id){
		return await this.getData('commentMap.'+reply_id)
	}

}

module.exports = GithubTarget