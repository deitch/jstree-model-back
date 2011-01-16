/*
 * jsTreeModel 0.98
 * http://jsorm.com/
 *
 * Dual licensed under the MIT and GPL licenses (same as jQuery):
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 * 
 * Created for Tufin www.tufin.com
 * Contributed to public source through the good offices of Tufin
 *
 * $Date: 2011-01-02 $
 * $Revision:  $
 */

/*global window, jQuery*/

/* 
 * This plugin gets jstree to use a class model to retrieve data, creating great dynamism
 */
(function ($) {
	var nodeInterface = ["hasChildren","getAttr","getName","getProps","openNode","closeNode"];
	// ensure that something matches an interface
	var validateInterface = function(obj,inter) {
		var valid = true, i;
		obj = obj || {};
		inter = [].concat(inter);

		for (i=0;i<inter.length;i++) {
			if (!obj.hasOwnProperty(inter[i]) || typeof(obj[inter[i]]) !== "function") {
				valid = false;
			}
		}
		return(valid);
	};
	var genAddChildrenHandler = function(parent,that,do_clean) {
		return function(e,children,index) {
			var tmp, ul;
			// parse the children we got, add them to the existing node
			children = [].concat(children);
			if (children.length > 0) {
				tmp = that._parse_model(parent,children, true);
				if (tmp) {
					// is there already a ul?
					ul = parent.children("ul");
					if (!ul || ul.length < 1) {
						ul = $("<ul></ul>").appendTo(parent);
					}
					// where do we add them?
					if (isNaN(index)) {
						ul.append(tmp);
					} else {
						ul.children("li:eq("+index+")").after(tmp);
					}
					//parent.removeClass("jstree-closed").removeClass("jstree-leaf").addClass("jstree-open");
					if (do_clean) {that.clean_node(parent);}
				}
			}
		};
	};
	var genRemoveChildrenHandler = function(parent,that) {
		return function(e,children,index) {

		};
	};
	$.jstree.plugin("model_data", {
		__init : function() {
			var s = this._get_settings().model_data;
			var anim = this._get_settings().core.animation;
			// when a node is closed, if progressive_clean is in place, we clean up the node
			// NOTE: THIS IS A BUG - close_node.jstree event is sent *before* the hide action is complete
			//     jstree does not have a post-close event, but a request is in place
			if (s.progressive_unload) {
				this.get_container().bind("close_node.jstree", $.proxy(function (e, data) {
					// remove the children
					data.rslt.obj.children("ul").detach();
				}, this));
			};
		},
		defaults : { 
			data : false,
			correct_state : true,
			progressive_render : false,
			progressive_unload : false
		},
		_fn : {
			// called to load a node, given the node object, success callback, and error callback
			load_node : function (obj, s_call, e_call) { 
				var _this = this; 
				// just run load_node_model, which is specialized for the model-based data set
				this.load_node_model(obj, function () { _this.__callback({ "obj" : obj }); s_call.call(this); }, e_call); 
			},
			// check if a particular node is loaded
			_is_loaded : function (obj) { 
				var s = this._get_settings().model_data, d, ret;
				obj = this._get_node(obj);
				if (!obj || obj === -1 || obj.children("ul").children("li").length > 0) {
					ret = true;
				} else {
					ret = false;
				}
				return(ret);
			},
			// load a specific node and its children from the model, given the object, success callback, and failure callback
			load_node_model : function (obj, s_call, e_call) {
				var s = this.get_settings().model_data, d, c,
					error_func = function () {},
					success_func = function () {}, uNode, node, that = this;
				// get the jQuery LI node from the object, or -1 if the container
				obj = this._get_node(obj);
				// if this is a real element and not the root
				//    - if already loading, do nothing
				//    - if not, mark as loading
				if(obj && obj !== -1) {
					if(obj.data("jstree-is-loading")) { return; }
					else { obj.data("jstree-is-loading",true); }
				}
				// make sure we have data set that fits the function
				if (!s.data || typeof(s.data) !== "object") {
					throw "Data settings model not supplied.";
				} else if (!validateInterface(s.data,nodeInterface)) {
					throw "Data settings model does not have valid interface.";
				} else {
					// behave differently if we are at the root or not
					// root, get its children; not root, get itself
					node = !obj || obj === -1 ? s.data : obj.data("jstree-model");
					uNode = !obj || obj === -1 ? this.get_container().empty() : obj;


					// listen for the changes about which we care
					if ((!obj || obj === -1) && node.bind && typeof(node.bind) === "function") {
						node.bind("addChildren.jstree",genAddChildrenHandler(uNode,that,true));
						node.bind("removeChildren.jstree",genRemoveChildrenHandler(uNode,that));
						node.bind("nodeChange.jstree",function(){
						});
					}
					// now open the node - which is what happens when jstree calls load_node
					node.openNode(function(){
						if (obj && obj.data) {
							obj.data("jstree-is-loading",false);
						}
						if (s_call && typeof(s_call) === "function") {
							s_call.call(that);
						}
					});
				}
			},
			_parse_model : function (parent, m, is_callback) {
				var d = false, 
					p = this._get_settings(),
					s = p.model_data,
					t = p.core.html_titles,
					tmp, i, j, ul1, ul2, js, c, name, type, id, attr, that = this, props;

				if(!m) { return d; }
				// do we have a series of children?
				if($.isArray(m)) {
					d = $();
					if(!m.length) { return false; }
					for(i = 0, j = m.length; i < j; i++) {
						tmp = this._parse_model(parent, m[i], true);
						if(tmp.length) { d = d.add(tmp); }
					}
				}
				else {
					// ensure it meets the interface requirements
					if (!validateInterface(m,nodeInterface)) {
						return d;
					}
					attr = m.getAttr();
					props = m.getProps() || {};
					js = {attr: attr, data: m.getName(), state: props.state};
					name = [].concat(m.getName());
					type = m.getType && typeof(m.getType) === "function" ? m.getType() : null;
					id = attr.id;


					d = this.create_node(parent, "inside", js,null,true);

					// type support
					if (type) {
						d.attr(s.type_attr || "rel",type);
					}
					// id prefix support
					if (id) {
						d.attr("id",(s.id_prefix || "")+id);
					}

					// save the instance for this data on the node itself
					d.data("jstree-model",m);

					// listen for the changes about which we care
					if (m.bind && typeof(m.bind) === "function") {
						m.bind("addChildren.jstree",genAddChildrenHandler(d,that,true));
						m.bind("removeChildren.jstree",genRemoveChildrenHandler(d,that));
						m.bind("nodeChange.jstree",function(){
						});
					}

					// if we have children, either get them if !progressive_render, or indicate that we are closed if progressive_render
					if(m.hasChildren()) { 
						if(s.progressive_render && js.state !== "open") {
							d.addClass("jstree-closed").removeClass("jstree-open jstree-leaf");
						} else {
							m.openNode(function(){});
						}
					}

				}
				if(!is_callback) {
					ul1 = $("<ul>");
					ul1.append(d);
					d = ul1;
				}
				return d;
			}
		}
	});
})(jQuery);
