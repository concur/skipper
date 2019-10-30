
var DynamoUtil = function() {};

DynamoUtil.config = {
	stringset_parse_as_set: false,
	numberset_parse_as_set: false,
	binaryset_parse_as_set: false,
	empty_string_replace_as: "",
}

// works for nodeJS 0.x and iojs,
// Array.from( Set ) doesnt
var array_from_set = function(s) {
	var r = []
	s.forEach(function(n){ r.push(n) })
	return r
}
DynamoUtil.Raw = function(data) {
	this.data = data
}

DynamoUtil.anormalizeList = function(list) {
	var $ret = []
	for (var $i in list) {
		$ret.push(DynamoUtil.anormalizeItem(list[$i]))
	}
	return $ret;
}
/* possible that is no longer needed, replaced by stringify() */
DynamoUtil.anormalizeItem = function(item) {
	var anormal = {}
	for (var key in item) {
		if (item.hasOwnProperty(key)) {
			anormal[key] = DynamoUtil.stringify(item[key])
		}
	}
	return anormal;
}


DynamoUtil.stringify = function( $value ) {
	if (typeof $value == 'boolean')
		return {'BOOL' : $value }

	if (typeof $value == 'number')
		return {'N' : $value.toString() }

	if (typeof $value == 'string') {
		if ($value.length === 0) {
			if (DynamoUtil.config.empty_string_replace_as === "") {
				return {'S' : $value }
			} else if (DynamoUtil.config.empty_string_replace_as === undefined) {
				return undefined
			}
			return DynamoUtil.stringify( DynamoUtil.config.empty_string_replace_as )
		}
		return {'S' : $value }
	}

	if ($value === null)
		return {'NULL' : true }

	if (Buffer.isBuffer($value))
		return {'B' : $value }

	// stringSet, numberSet
	if ((typeof $value == 'object') && ($value instanceof DynamoUtil.Raw) ) {
		return $value.data
	}

	if (typeof $value == 'object') {
		if(Array.isArray($value) ) {
			var to_ret = {'L': [] }
			for (var i in $value) {
				if ($value.hasOwnProperty(i)) {
					to_ret.L[i] = DynamoUtil.stringify($value[i] )
				}
			}
			return to_ret
		}

		if ($value instanceof Set) {
			var is_ss = true;
			var is_ns = true;

			// count elements in Set
			if ($value.size === 0) {
				is_ss = false;
				is_ns = false;
			}

			$value.forEach(function (v) {
				if ( typeof v === "string" ) {
					is_ns = false;
				} else if ( typeof v === "number" ) {
					is_ss = false;
				} else {
					is_ss = false;
					is_ns = false;
				}
			})
			if (is_ss)
				return { 'SS': array_from_set($value) }

			if (is_ns)
				return {
					'NS': array_from_set($value).map(function(item) { return item.toString() })
				}

			return {
				'L': array_from_set($value).map(function(item) { return DynamoUtil.stringify(item) })
			}
		}

		var to_ret = {'M': {} }
		for (var i in $value) {
			if ($value.hasOwnProperty(i)) {
					var val = DynamoUtil.stringify($value[i] )

					if (val !== undefined ) // when empty string is replaced with undefined
						to_ret.M[i] = val
				}
			}
			return to_ret
	}

	// @todo: support other types
}


DynamoUtil.anormalizeType = function( $value ) {
	if (typeof $value == 'boolean')
		return 'BOOL'

	if (typeof $value == 'number')
		return 'N'

	if (typeof $value == 'string')
		return 'S'

	if (Array.isArray($value))
		return 'L'

	if ($value === null) {
		return 'NULL'
	}
	// @todo: support other types
}

/*
DynamoUtil.normalizeList = function($items) {
	var $list = []
	for (var i in $items) {
		$list.push(DynamoUtil.normalizeItem($items[i]))
	}
	return $list;
}
*/

DynamoUtil.parse = function(v) {
	if (typeof v !== 'object')
		throw 'expecting object';

	if (Object.keys(v).length !== 1)
		throw 'expecting only one property in object: S, N, BOOL, NULL, L, M, etc ';

	if (v.hasOwnProperty('S')) {
		if ( v.S === DynamoUtil.config.empty_string_replace_as )
			return '';

		return v.S
	}

	if (v.hasOwnProperty('N'))
		return parseFloat(v.N)

	if (v.hasOwnProperty('BOOL'))
		return v.BOOL

	if (v.hasOwnProperty('NULL'))
		return null

	if (v.hasOwnProperty('B')) {
		if (typeof Buffer.from === "function") { // Node 5.10+
			return Buffer.from( v.B, 'base64' );
		} else { // older Node versions, now deprecated
			return new Buffer( v.B, 'base64' );
		}
	}

	if (v.hasOwnProperty('SS')) {
		if (DynamoUtil.config.stringset_parse_as_set)
			return new Set(v.SS)

		return v.SS
	}

	if (v.hasOwnProperty('NS')) {
		if (DynamoUtil.config.numberset_parse_as_set)
			return new Set(v.NS.map(function(el) { return parseFloat(el)}))

		return v.NS.map(function(el) { return parseFloat(el)})
	}

	if (v.hasOwnProperty('BS')) {
		if (DynamoUtil.config.binaryset_parse_as_set)
			return new Set(v.BS.map(function(el) { return el }))

		return v.BS.map(function(el) { return el })
	}

	if (v.hasOwnProperty('L')){
		var normal = [];
		for (var i in v.L ) {
			if (v.L.hasOwnProperty(i)) {
				normal[i] = DynamoUtil.parse(v.L[i])
			}
		}
		return normal;
	}

	if (v.hasOwnProperty('M')) {
		var normal = {}
		for (var i in v.M ) {
			if (v.M.hasOwnProperty(i)) {
				normal[i] = DynamoUtil.parse(v.M[i])
			}
		}
		return normal;
	}
}

DynamoUtil.normalizeItem = function($item) {
	// disabled for now so we dont break compatibility with older versions, should return null on undefined $item
	//if (!$item)
	//	return null

	var normal = {}
	for (var key in $item) {
		if ($item.hasOwnProperty(key)) {
			if ($item[key].hasOwnProperty('S'))
				normal[key] = $item[key]['S']

			if ($item[key].hasOwnProperty('N'))
				normal[key] = +($item[key]['N'])

			if ($item[key].hasOwnProperty('BOOL'))
				normal[key] = $item[key]['BOOL']

			if ($item[key].hasOwnProperty('NULL'))
				normal[key] = null

			if ($item[key].hasOwnProperty('B'))
				normal[key] = $item[key]['B']

			if ($item[key].hasOwnProperty('SS'))
				normal[key] = $item[key]['SS']

			if ($item[key].hasOwnProperty('NS')) {
				normal[key] = []
				$item[key]['NS'].forEach(function(el,idx) {
					normal[key].push(parseFloat(el))
				})
			}

			if ($item[key].hasOwnProperty('L')){
				normal[key] = []
				for (var i in $item[key]['L'] ) {
					if ($item[key]['L'].hasOwnProperty(i)) {
						normal[key][i] = DynamoUtil.normalizeItem({
								key: $item[key]['L'][i]
						}).key
					}
				}
			}

			if ($item[key].hasOwnProperty('M')) {
				normal[key] = {}
				for (var i in $item[key]['M'] ) {
					if ($item[key]['M'].hasOwnProperty(i)) {
						normal[key][i] = DynamoUtil.normalizeItem({
								key: $item[key]['M'][i]
						}).key
					}
				}
			}
		}
	}
	return normal;
}


DynamoUtil.buildExpected = function( $expected ) {
	var anormal = {}

	for (var key in $expected ) {
		if ($expected.hasOwnProperty(key)) {

				var whereVal = {}

				if ((typeof $expected[key] == 'object') && ($expected[key] instanceof DynamoUtil.Raw) ) {
					anormal[key] = $expected[key].data
				} else if ($expected[key].hasOwnProperty('value2') && $expected[key].value2 !== undefined ) {
					anormal[key] = {
						ComparisonOperator: $expected[key].operator,
						AttributeValueList: [ DynamoUtil.stringify( $expected[key].value ), DynamoUtil.stringify( $expected[key].value2 ) ]
					}
				} else {
					anormal[key] = {
						ComparisonOperator: $expected[key].operator,
						AttributeValueList: [ DynamoUtil.stringify( $expected[key].value ) ]
					}
				}
		}
	}
	return anormal
}


DynamoUtil.expression_name_split = function(item) {
	var ret = []
	var split = ''
	var in_brackets = false
	for (var i = 0;i<item.length;i++) {
		if (in_brackets) {
			if (item[i] == '"') {
				in_brackets = false
				ret.push(split)
				split = ''
			} else {
				split+=item[i]
			}
		} else {
			if (item[i] == '"') {
				in_brackets = true
			} else {
				if (item[i] == '.') {
					ret.push(split)
					split = ''
				} else {
					split+=item[i]
				}
			}
		}
	}
	ret.push(split)
	return ret.filter(function(v) { return v.trim() !== '' })
}
DynamoUtil.clone = function ( source) {

	var from;
	var to = Object({});
	var symbols;

	for (var s = 0; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (Object.prototype.hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (Object.getOwnPropertySymbols) {
			symbols = Object.getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (Object.prototype.propertyIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
}


DynamoUtil.toSQLJSON = function(o, is_list ) {

	if (is_list) {
		return "[" + o.map(function(l) {
			if (l.hasOwnProperty('S'))
				return JSON.stringify(l.S)
			if (l.hasOwnProperty('N'))
				return l.N;
			if (l.hasOwnProperty('B'))
				return "Buffer.from('" + l.B.toString('base64') + "', 'base64')";
			if (l.hasOwnProperty('BOOL'))
				return l.BOOL;
			if (l.hasOwnProperty('NULL'))
				return 'null';
			if (l.hasOwnProperty('SS'))
				return "new StringSet(" + JSON.stringify(l.SS) + ")";
			if (l.hasOwnProperty('NS'))
				return "new NumberSet(" + JSON.stringify(l.NS.map(function(n) { return parseFloat(n) })) + ")";
			if (l.hasOwnProperty('BS'))
				return "new BinarySet([" + l.BS.map(function(b) { return "Buffer.from('" + b.toString('base64') + "', 'base64')" }).join(',') + "])";
			if (l.hasOwnProperty('M'))
				return DynamoUtil.toSQLJSON(l.M);
			if (l.hasOwnProperty('L'))
				return DynamoUtil.toSQLJSON(l.L, true );

			return JSON.stringify(l)
		}).join(',') + ']'
	}

	var oeach = []
	Object.keys(o).map(function(k) {
		if (o[k].hasOwnProperty('S'))
			oeach.push("'" + k + "':" + JSON.stringify(o[k].S));
		if (o[k].hasOwnProperty('N'))
			oeach.push("'" + k + "':" + o[k].N);
		if (o[k].hasOwnProperty('B'))
			oeach.push("'" + k + "':" + "Buffer.from('" + o[k].B.toString('base64') + "', 'base64')" );
		if (o[k].hasOwnProperty('BOOL'))
			oeach.push("'" + k + "':" + o[k].BOOL );
		if (o[k].hasOwnProperty('NULL'))
			oeach.push("'" + k + "':" + 'null' );
		if (o[k].hasOwnProperty('SS'))
			oeach.push("'" + k + "':" + "new StringSet(" + JSON.stringify(o[k].SS) + ")" );
		if (o[k].hasOwnProperty('NS'))
			oeach.push("'" + k + "':" + "new NumberSet(" + JSON.stringify(o[k].NS.map(function(n) { return parseFloat(n) })) + ")" );
		if (o[k].hasOwnProperty('BS'))
			oeach.push("'" + k + "':" + "new BinarySet([" + o[k].BS.map(function(b) { return "Buffer.from('" + b.toString('base64') + "', 'base64')" }).join(',') + "])" );
		if (o[k].hasOwnProperty('M'))
			oeach.push("'" + k + "':" + DynamoUtil.toSQLJSON(o[k].M)  );
		if (o[k].hasOwnProperty('L'))
			oeach.push("'" + k + "':" + DynamoUtil.toSQLJSON(o[k].L, true ) );

	})
	return "{" + oeach.join(',') + '}'
}




// backword compatibitity
DynamoUtil.anormalizeValue = DynamoUtil.stringify;
DynamoUtil.normalizeValue  = DynamoUtil.parse;

module.exports = DynamoUtil
