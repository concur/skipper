util = require('../index')
assert = require('core-assert')

describe('stringify()', function () {

	it('string', function(done) {
		var d = util.stringify( 'text' )
		assert.deepStrictEqual(d, { S: 'text'})
		done()
	});
	it('empty string', function(done) {
		var d = util.stringify( '' )
		assert.deepStrictEqual(d, { S: ''})
		done()
	});
	it('empty string - replaced with null', function(done) {
		util.config.empty_string_replace_as = null
		var d = util.stringify( '' )
		assert.deepStrictEqual(d, { NULL: true})
		done()
	});
	it('empty string - replaced with \\0', function(done) {
		util.config.empty_string_replace_as = "\0"
		var d = util.stringify( '' )
		assert.deepStrictEqual(d, { S: "\0"})
		done()
	});
	it('empty string in List - replaced with \\0', function(done) {
		util.config.empty_string_replace_as = "\0"
		var d = util.stringify( [1,'a','',null ] )
		assert.deepStrictEqual(d, { L: [ { N: '1' }, { S: 'a' }, { S: '\u0000' }, { NULL: true } ] })
		done()
	});
	it('empty string in Map - replaced with \\0', function(done) {
		util.config.empty_string_replace_as = "\0"
		var d = util.stringify( { number: 1,text: 'a', empty: '', nulled: null } )
		assert.deepStrictEqual(d, { M:  { number: { N: '1' }, text: { S: 'a' }, empty: { S: '\u0000' }, nulled: { NULL: true } } })
		done()
	});
	it('empty string - replaced with undefined', function(done) {
		util.config.empty_string_replace_as = undefined
		var d = util.stringify( { number: 1, string: 'test', empty_string: '' } )
		assert.deepStrictEqual(d, {"M":{"number":{"N":"1"},"string":{"S":"test"}}} )
		done()
	});

	it('number', function(done) {
		var d = util.stringify( 1.5 )
		assert.deepStrictEqual(d, { N: '1.5'})
		done()
	});

	it('boolean true', function(done) {
		var d = util.stringify( true )
		assert.deepStrictEqual( d,  {BOOL: true} )
		done()
	});

	it('boolean false', function(done) {
		var d = util.stringify( false )
		assert.deepStrictEqual( d,  {BOOL: false} )
		done()
	});

	it('null', function(done) {
		var d = util.stringify( null )
		assert.deepStrictEqual( d,  {NULL: true} )
		done()
	});
	it('[]', function(done) {
		var d = util.stringify( [] )
		assert.deepStrictEqual( d,  {L: [] } )
		done()
	});
	it('[1,"text",true, false, null, [], {} ]', function(done) {
		var d = util.stringify( [1,"text",true, false, null, [], {} ] )
		assert.deepStrictEqual( d,  {L: [
			{N: '1' },
			{S: 'text'},
			{BOOL: true},
			{BOOL: false},
			{NULL: true},
			{L: []},
			{M: {}}
		] } )
		done()
	});

	it('{}', function(done) {
		var d = util.stringify( {} )
		assert.deepStrictEqual( d,  {M: {} } )
		done()
	});

	it('{ number: 1, string: "text", bool: true, nulled: null, arr: [], obj: {} }', function(done) {
		var d = util.stringify( { number: 1, string: "text", bool: true, nulled: null, arr: [], obj: {} } )
		assert.deepStrictEqual( d,  {M: {
			number: {N: '1'},
			string: {S: 'text'},
			bool: { BOOL: true},
			nulled: {NULL: true},
			arr: {L: []},
			obj: {M: {}},
		} } )
		done()
	});

	it('binary', function(done) {
		var d = util.stringify( new Buffer("\0") )
		assert.deepStrictEqual( d,  { B: new Buffer("\0") } )
		done()
	});

	it('StringSet from Set', function(done) {
		var d = util.stringify( new Set(['a','b', 'c']) )
		assert.deepStrictEqual( d,  { SS: [ 'a', 'b', 'c' ] } )
		done()
	});
	it('NumberSet from Set', function(done) {
		var d = util.stringify( new Set([1,2,-3]) )
		assert.deepStrictEqual( d,  { NS: [ "1", "2", "-3" ] } )
		done()
	});
	it('List from empty Set', function(done) {
		var d = util.stringify( new Set() )
		assert.deepStrictEqual( d,  { L: [] } )
		done()
	});
	it('List from mixed Set', function(done) {
		var d = util.stringify( new Set(['string', 1 ]) )
		assert.deepStrictEqual( d,  { L: [ { S: 'string' },  { N: '1'} ] } )
		done()
	});
})











describe('parse()', function () {

	it('string', function(done) {
		var d = util.parse( { S: 'text' } )
		assert.deepStrictEqual(d, 'text' )
		done()
	});


	it('empty string - replaced with \\0', function(done) {
		util.config.empty_string_replace_as = "\0"
		var d = util.parse( { S: "\0" } )
		assert.deepStrictEqual(d, "" )
		done()
	});

	it('empty string in List - replaced with \\0', function(done) {
		util.config.empty_string_replace_as = "\0"
		var d = util.parse( { L: [ { N: '1' }, { S: 'a' }, { S: '\u0000' }, { NULL: true } ] } )

		assert.deepStrictEqual(d, [1,"a","",null] )
		done()
	});
	it('empty string in Map - replaced with \\0', function(done) {
		util.config.empty_string_replace_as = "\0"
		var d = util.parse( { M:  { number: { N: '1' }, text: { S: 'a' }, empty: { S: '\u0000' }, nulled: { NULL: true } } } )
		assert.deepStrictEqual(d, {"number":1,"text":"a","empty":"","nulled":null} )
		done()
	});


	it('number', function(done) {
		var d = util.parse( { N: '1.5'} )
		assert.deepStrictEqual(d, 1.5 )
		done()
	});

	it('boolean true', function(done) {
		var d = util.parse( {BOOL: true} )
		assert.deepStrictEqual( d, true  )
		done()
	});

	it('boolean false', function(done) {
		var d = util.parse( {BOOL: false} )
		assert.deepStrictEqual( d, false  )
		done()
	});

	it('null', function(done) {
		var d = util.parse( {NULL: true} )
		assert.deepStrictEqual( d, null  )
		done()
	});
	it('[]', function(done) {
		var d = util.parse( {L: [] } )
		assert.deepStrictEqual( d, []  )
		done()
	});
	it('[1,"text",true, false, null, [], {} ]', function(done) {
		var d = util.parse(
			{
				L: [
					{N: '1' },
					{S: 'text'},
					{BOOL: true},
					{BOOL: false},
					{NULL: true},
					{L: []},
					{M: {}}
				]
			}
		)
		assert.deepStrictEqual( d, [1,"text",true, false, null, [], {} ]  )
		done()
	});

	it('{}', function(done) {
		var d = util.parse( {M: {} } )
		assert.deepStrictEqual( d, {} )
		done()
	});

	it('{ number: 1, string: "text", bool: true, nulled: null, arr: [], obj: {} }', function(done) {
		var d = util.parse(

			{
				M: {
					number: {N: '1'},
					string: {S: 'text'},
					bool: { BOOL: true},
					nulled: {NULL: true},
					arr: {L: []},
					obj: {M: {}},
				}
			}


			 )
		assert.deepStrictEqual( d, { number: 1, string: "text", bool: true, nulled: null, arr: [], obj: {} } )
		done()
	});

	it('binary', function(done) {
		var d = util.parse( { B: "4oyb77iPIGhvdXJnbGFzcy4g8J+VkCBjbG9jay4g4oyaIHdhdGNoLg==" } )
		assert.deepStrictEqual( d.toString('utf-8'), "⌛️ hourglass. 🕐 clock. ⌚ watch."  )
		done()
	});






	it('StringSet([ "a","b","c"]) with stringset_parse_as_set = false', function(done) {
		var d = util.parse(
			{
				SS: [ "a","b","c" ]
			}
		)

		assert.deepStrictEqual( d, [ "a","b","c" ] )
		done()
	});

	it('StringSet([ "a","b","c"]) with stringset_parse_as_set = true', function(done) {
		util.config.stringset_parse_as_set = true
		var d = util.parse(
			{
				SS: [ "a","b","c" ]
			}
		)
		assert.deepStrictEqual( d, new Set([ "a","b","c" ]) )
		util.config.stringset_parse_as_set = false
		done()
	});
	it('NumberSet([ 11,22,33]) with numberset_parse_as_set = false', function(done) {
		var d = util.parse(
			{
				NS: [ '11','22','33' ]
			}
		)

		assert.deepStrictEqual( d, [ 11,22,33 ] )
		done()
	});

	it('NumberSet([ 11,22,33]) with numberset_parse_as_set = true', function(done) {
		util.config.numberset_parse_as_set = true
		var d = util.parse(
			{
				NS: [ '11','22','33' ]
			}
		)
		assert.deepStrictEqual( d, new Set([ 11,22,33 ]) )
		util.config.numberset_parse_as_set = false
		done()
	});
})
