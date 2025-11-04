// docpad-plugin-tree: Forked + Replaced with Custom Working Implementation

const Plugin = require('docpad').Plugin;
const _ = require('underscore');
_.str = require('underscore.string');
_.mixin(_.str.exports());

module.exports = Plugin.extend({
    name: 'tree',

    /**
     * Build a hierarchical tree from a DocPad collection
     * @param {String|Object} collection - Collection name or collection object
     * @param {Object|null} context - Active document to mark active/current states
     * @param {Boolean} includeRoot - Whether to add a root-level '/'
     */
    tree(collection, context, includeRoot) {
        const urlRegex = /^\/|\/$|index\.\w*$/g;

        class Tree {
            constructor(collection, includeRoot) {
                this.documents = {};

                const addChild = (doc, parts, parent, index) => {
                    const part = parts[index];
                    const current = parent[part] || (parent[part] = { children: {} });

                    if (index === parts.length - 1) {
                        current.title = doc.menu || doc.title;
                        current.url = doc.url;
                        current.order = doc.order || 0;
                        current.hidden = doc.hidden || false;
                    } else {
                        addChild(doc, parts, current.children, index + 1);
                    }
                };

                collection.forEach((doc) => {
                    let parts = doc.url.replace(urlRegex, '').split('/');
                    parts = _.compact(parts);

                    if (includeRoot) parts.unshift('/');

                    if (parts.length) {
                        addChild(doc, parts, this.documents, 0);
                    }
                });
            }

            toJSON(context) {
                const output = [];

                const addDocument = (parent, current) => {
                    if (current.hidden) return;

                    parent.push(current);

                    // Add active/current states
                    if (context) {
                        const contextUrl = context.url.replace(urlRegex, '');
                        const currentUrl = current.url.replace(urlRegex, '');

                        current.active = _.startsWith(contextUrl, currentUrl);
                        current.current = contextUrl === currentUrl;
                    }

                    // Sort children
                    const sortedChildren = _.sortBy(current.children, (doc) => parseFloat(doc.order));

                    // Remove or recurse
                    if (_.isEmpty(sortedChildren)) {
                        delete current.children;
                        return;
                    }

                    current.children = [];
                    Object.keys(sortedChildren).forEach((childKey) => {
                        addDocument(current.children, sortedChildren[childKey]);
                    });
                };

                const rootDocs = _.sortBy(this.documents, (doc) => parseFloat(doc.order));
                Object.keys(rootDocs).forEach((key) => {
                    addDocument(output, rootDocs[key]);
                });

                return output;
            }
        }

        // Resolve the collection object
        let coll =
            typeof collection === 'string'
                ? this.docpad.getCollection(collection)
                : collection;

        // Convert collection to plain JSON array
        coll = coll.toJSON();

        const tree = new Tree(coll, includeRoot);
        return tree.toJSON(context);
    }
});
