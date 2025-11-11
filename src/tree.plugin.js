"use strict";

const _ = require("underscore");
_.str = require("underscore.string");
_.mixin(_.str.exports());

// ----------------------------
// Tree Builder Class
// ----------------------------
class Tree {
    constructor(collection, includeRoot) {
        // Root documents object
        this.documents = {};

        // Normalize URLs for tree building (but never modify DocPad URLs)
        this.urlRegex = /^\/|\/$|index\.\w*$/g;

        const addChild = (doc, parts, parent, index) => {
            const part = parts[index];

            // Initialize new node if needed
            const current = parent[part] = parent[part] || { children: {} };

            // Is this the leaf node?
            if (index === parts.length - 1) {
                current.title = doc.menu || doc.title;
                current.url = doc.url;
                current.order = doc.order || 0;
                current.hidden = doc.hidden || false;
            } else {
                addChild(doc, parts, current.children, index + 1);
            }
        };

        // Build tree for each document
        collection.forEach((doc) => {
            let parts = _.compact(doc.url.replace(this.urlRegex, "").split("/"));

            if (includeRoot) {
                parts.unshift("/");
            }

            if (parts.length > 0) {
                addChild(doc, parts, this.documents, 0);
            }
        });
    }

    // Convert internal nested structure into final JSON output
    toJSON(context) {
        const output = [];
        let documents = this.documents;
        const urlRegex = this.urlRegex;

        const addDocument = (parent, current) => {
            // Skip hidden entries
            if (current.hidden) return;

            parent.push(current);

            if (context) {
                const contextUrl = context.url.replace(urlRegex, "");
                const currentUrl = current.url.replace(urlRegex, "");

                current.active = _.startsWith(contextUrl, currentUrl);
                current.current = contextUrl === currentUrl;
            }

            let children = _.sortBy(current.children, (doc) => parseFloat(doc.order));

            if (_.isEmpty(children)) {
                delete current.children;
                return;
            }

            current.children = [];
            Object.keys(children).forEach((key) => {
                addDocument(current.children, children[key]);
            });
        };

        // First-level sorting
        documents = _.sortBy(documents, (doc) => parseFloat(doc.order));

        Object.keys(documents).forEach((key) => {
            addDocument(output, documents[key]);
        });

        return output;
    }
}

// ----------------------------
// DocPad Plugin
// ----------------------------
module.exports = function (BasePlugin) {
    class TreePlugin extends BasePlugin {
        get name() {
            return "tree";
        }

        extendTemplateData(options) {
            const docpad = this.docpad;
            const templateData = options.templateData;

            templateData.tree = function (collection, context, includeRoot = false) {
                if (collection === null) {
                    collection = "documents";
                }

                const docs = docpad.getCollection(collection);
                const tree = new Tree(docs.toJSON(), includeRoot);
                return tree.toJSON(context);
            };
        }
    }

    return TreePlugin;
};