'use strict';

// No more underscore. Using modern JS.

// Utility: remove empty parts from an array
const compact = arr => arr.filter(Boolean);

// Utility: string startsWith but safely
const startsWith = (str, prefix) => str.startsWith(prefix);

class Tree {
    constructor(collection, includeRoot) {
        this.documents = {};
        this.urlRegex = /^\/|\/$|index\.\w*$/g;

        collection.forEach(doc => {
            // Split URL → array of path segments
            let parts = compact(doc.url.replace(this.urlRegex, '').split('/'));

            if (includeRoot) {
                parts.unshift('/');
            }

            if (parts.length > 0) {
                this._addChild(doc, parts, this.documents, 0);
            }
        });
    }

    _addChild(doc, parts, parent, index) {
        const part = parts[index];

        // Initialize new "node" if missing
        const current = parent[part] = parent[part] || { children: {} };

        const isLeaf = (parts.length - 1) === index;

        if (isLeaf) {
            current.title = doc.menu || doc.title;
            current.url = doc.url;
            current.order = doc.order || 0;
            current.hidden = doc.hidden || false;
        } else {
            this._addChild(doc, parts, current.children, index + 1);
        }
    }

    toJSON(context) {
        const urlRegex = this.urlRegex;
        const output = [];

        const addDocument = (parentArr, current) => {
            if (current.hidden) return;

            parentArr.push(current);

            if (context) {
                const contextUrl = context.url.replace(urlRegex, '');
                const currentUrl = current.url.replace(urlRegex, '');

                current.active = startsWith(contextUrl, currentUrl);
                current.current = (contextUrl === currentUrl);
            }

            // Convert children object → sorted array
            const childNodes = Object.values(current.children || {});
            const sorted = childNodes.sort((a, b) => parseFloat(a.order) - parseFloat(b.order));

            if (sorted.length === 0) {
                delete current.children;
                return;
            }

            current.children = [];

            sorted.forEach(child => {
                addDocument(current.children, child);
            });
        };

        // First-level sort
        const firstLevel = Object.values(this.documents)
            .sort((a, b) => parseFloat(a.order) - parseFloat(b.order));

        firstLevel.forEach(child => addDocument(output, child));

        return output;
    }
}

module.exports = BasePlugin =>
    BasePlugin.extend({
        name: 'tree',

        extendTemplateData(options) {
            const docpad = this.docpad;
            const templateData = options.templateData;

            templateData.tree = (collection, context, includeRoot) => {
                if (!collection) collection = 'documents';

                const docs = docpad.getCollection(collection).toJSON();
                const tree = new Tree(docs, includeRoot);

                return tree.toJSON(context);
            };
        }
    });
