//const os = require( 'os' );
//const fs = require( 'fs' );
//const WebSocketModule = require('ws');
const Pop = require('./PopApi');
const ExpressModule = require('express');


function NumberOrNull(Value,Name)
{
	if ( Value == 'null' )
		return null;
	const Num = Number(Value);
	if ( isNaN(Num) )
		throw `${Value}(${Name}) needs to be a number`;
	return Value;
}
function IntegerOrNull(Value,Name)
{
	const Num = NumberOrNull(Value);
	if ( Num === null )
		return null;
	if ( !Number.isInteger(Num) )
		throw `${Value}(${Name}) needs to be integer`;
	return Num;
}

const ErrorStatusCode = 500;
const CorsOrigin = process.env.CorsOrigin || '*';
const TimeoutMs = IntegerOrNull( process.env.TimeoutMs || (10*60*1000), 'TimeoutMs' );
const ListenPort = IntegerOrNull( process.env.ListenPort || 80, 'ListenPort' );
const StaticFilesPath = process.env.StaticFilesPath || './';
try
{
	const AllEnv = JSON.stringify(process.env,null,'\t');
	console.log(`env (all) ${AllEnv}`);
}
catch(e)
{
	console.log(`env (all) error -> ${e}`);
}


const RecordStreamPacketDelin = 'Pop\n';	//	gr: i insert this before every packet when writing files, so we need it here too.
const ArtifactUrlPattern = new RegExp('\/([A-Za-z]){4}$')
const ArtifactAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ListUrl = '/list';
const RegisterUrl = '/register';
const DebugUrl = '/debug';
const AddressMatch = new RegExp('^(.+):([0-9]+)$');


//	artifact server
const HttpServerApp = ExpressModule();
HttpServerApp.get(RegisterUrl,HandleRegister);
HttpServerApp.get(DebugUrl,HandleDebug);
HttpServerApp.get(ListUrl,HandleList);
HttpServerApp.get('/', function (req, res) { res.redirect('/Readme.md') });
HttpServerApp.use('/', ExpressModule.static(StaticFilesPath));
const HttpServer = HttpServerApp.listen( ListenPort, () => console.log( `http server on ${JSON.stringify(HttpServer.address())}` ) );


function GetTimeNowMs()
{
	//	time in ms
	const NowMs = new Date().getTime();
	return NowMs;
}


class TRegistryEntry
{
	constructor()
	{
		//	each lan address has a "last known" time so we can timeout entries 
		this.LanAddresses = {};		//	["Address"] = 123;
	}

	UpdateTimeouts()
	{
		
	}

	GetList()
	{
		this.UpdateTimeouts();
		
		const Now = GetTimeNowMs();

		function EntryToStruct(AddressAndRegisterTime)
		{
			const Output = {};
			Output.Address = AddressAndRegisterTime[0];
			const RegisterTime = AddressAndRegisterTime[1];
			Output.Elapsed = Now - RegisterTime;
			return Output;
		}
		
		function CompareNewestStruct(a,b)
		{
			if ( a.Elapsed < b.Elapsed )
				return -1;
			if ( a.Elapsed > b.Elapsed )
				return 1;
			return 0;
		}
		
		//	turn the data into entries so we can sort them
		const SortedAddresses = Object.entries(this.LanAddresses).map(EntryToStruct).sort(CompareNewestStruct);
		
		const List = {};
		List.Addresses = SortedAddresses;
		return List;
	}
	
	Register(LanAddress)
	{
		this.LanAddresses[LanAddress] = GetTimeNowMs();
	}
}



const Registry = {};	//	[ip] = TRegistryEntry

function Register(ExternalAddress,LocalAddress)
{
	if ( !Registry.hasOwnProperty(ExternalAddress) )
	{
		Registry[ExternalAddress] = new TRegistryEntry();
	}

	//	verify local address	
	if ( !LocalAddress )
		throw `Local address parameter null/missing ${LocalAddress}`;
		
	//	require port
	if ( !LocalAddress.match(AddressMatch) )
		throw `Local address (${LocalAddress}) didn't match pattern. Expecting "Name:port" (port required)`;
	
	const Entry = Registry[ExternalAddress];
	Entry.Register(LocalAddress);
}

function GetList(ExternalAddress)
{
	const Entry = Registry[ExternalAddress];
	const ListObject = Entry ? Entry.GetList() : {};
	return ListObject;
}

function GetExternalAddress(Request)
{
	//	see here for proxy solutions
	//	maybe use request-ip
	//	https://stackoverflow.com/a/10849772/355753
	//const Address = `${Request.connection.remoteAddress}`;
	//	express has just .ip
	//	http://expressjs.com/en/api.html#req.ip
	const Address = `${Request.ip}`;
	return Address;
}


async function HandleList(Request,Response)
{
	try
	{
		const ExternalAddress = GetExternalAddress(Request);
		const List = GetList(ExternalAddress);
		const Body = JSON.stringify(List,null,'\t');
		const Mime = 'application/json';
		
		Response.statusCode = 200;
		Response.setHeader('Content-Type',Mime);
		Response.setHeader('Access-Control-Allow-Origin',CorsOrigin);	//	allow CORS
		Response.end(Body);
	}
	catch (e)
	{
		console.log(`HandleList error -> ${e}`);
		Response.statusCode = ErrorStatusCode;
		Response.setHeader('Content-Type','text/plain');
		Response.end(`Error ${e}`);
	}
}


async function HandleDebug(Request,Response)
{
	try
	{
		const ExternalAddress = GetExternalAddress(Request);
		const Body = JSON.stringify( Registry, null, '\t' );
		const Mime = 'application/json';
		
		Response.statusCode = 200;
		Response.setHeader('Content-Type',Mime);
		Response.setHeader('Access-Control-Allow-Origin',CorsOrigin);	//	allow CORS
		Response.end(Body);
	}
	catch (e)
	{
		console.log(`HandleDebug error -> ${e}`);
		Response.statusCode = ErrorStatusCode;
		Response.setHeader('Content-Type','text/plain');
		Response.end(`Error ${e}`);
	}
}



async function HandleRegister(Request,Response)
{
	try
	{
		//	register, then just return list to aid debugging
		const ExternalAddress = GetExternalAddress(Request);
		const LocalAddress = Request.query.address;
		Register( ExternalAddress, LocalAddress );
		
		return HandleList(Request,Response);
	}
	catch (e)
	{
		console.log(`HandleRegister error -> ${e}`);
		Response.statusCode = ErrorStatusCode;
		Response.setHeader('Content-Type','text/plain');
		Response.end(`Error ${e}`);
	}
}


