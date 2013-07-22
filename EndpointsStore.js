/*
    Copyright 2013 Sander Striker

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
 */
define([
    'dojo/_base/array',
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/store/util/QueryResults',
    'dojo/Deferred'
    /*=====, "dojo/store/api/Store" =====*/
], function (array, declare, lang, QueryResults, Deferred /*=====, Store =====*/) {

    // No base class, but for purposes of documentation, the base class is dojo/store/api/Store
    var base = null;
    /*===== base = Store; =====*/

    /*=====
     var __PutDirectives = declare(Store.PutDirectives),
         __QueryOptions = declare(Store.QueryOptions);
     =====*/

    return declare(base, {
        //  summary:
        //      A `dojo/store` store backed by google endpoints.

        // api: Object
        //      Google Javascript Client API to use for this store.
        api: null,

        // idProperty: String
        //      If the store has a single primary key, this indicates the property to use as the
        //      identity property. The values of this property should be unique.
        idProperty: 'id',

        constructor: function (options) {
            // summary:
            //      This is a basic store for communicating with through the Google Javascript Client.
            // options: EndpointsStore
            //      This provides any configuration information that will be mixed into the store

            declare.safeMixin(this, options);

            //
            console.assert(this.api, 'API not defined');
        },

        _execute: function (request) {
            //  summary:
            //      Executes an endpoints request and returns a promise.

            var deferred = new Deferred(); // No cancel function, as we can't cancel the request.
            request.execute(function (response) {
                if (response.error) {
                    deferred.reject(response.error);
                    return;
                }
                deferred.resolve(response.result || response);
            });
            return deferred.promise;
        },

        get: function (id) {
            // summary:
            //      Retrieves an object by its identity.  This will trigger a call to api.get(id).
            // id: String
            //      The identity to use to lookup the object
            // returns: Object
            //      The object in the store that matches the given id.

            var params = {};
            params[this.idProperty] = id;
            return this._execute(this.api.get(params));
        },

        getIdentity: function (object) {
            // summary:
            //      Returns an object's identity
            // object: Object
            //      The object to get the identity from
            // returns: String

            return object[this.idProperty];
        },

        put: function (object, options) {
            // summary:
            //      Stores an object. This will trigger a call to api.update(object).
            // object: Object
            //      The object to store.
            // options: __PutDirectives?
            //      Additional metadata for storing the data.  Includes an "id"
            //      property if a specific id is to be used.
            // returns: dojo/promise/Promise

            options = options || {};
            var id = ('id' in options) ? options.id : this.getIdentity(object);
            var hasId = typeof id != 'undefined';
            if (!hasId) {
                return this.add(object, options);
            }
            // TODO handle case where object[this.idProperty] isn't set.
            // TODO handle patch (options.overwrite === false)
            return this._execute(this.api.update(object));
        },

        add: function (object, options) {
            // summary:
            //      Adds an object.  This will trigger a call to api.insert(object).
            // object: Object
            //      The object to store.
            // options: __PutDirectives?
            //		Additional metadata for storing the data.  Unused.

            options = options || {};
            var id = ('id' in options) ? options.id : this.getIdentity(object);
            var hasId = typeof id != 'undefined';
            // TODO error out if hasId
            return this._execute(this.api.insert(object));
        },

        remove: function (id) {
            // summary:
            //      Deletes an object by its identity.  This will trigger a call to api.remove(id)
            // id: String
            //      The identity to use to delete the object
            // options: Object?
            //      Unused.

            var params = {};
            params[this.idProperty] = id;
            return this._execute(this.api.remove(params));
        },

        query: function (query, options) {
            // summary:
            //      Queries the store for objects. This will trigger a call to api.list().
            // query: Object
            //      The query to use for retrieving objects from the store.
            // options: __QueryOptions?
            //      The optional arguments to apply to the resultset.
            // returns: dojo/store/api/Store.QueryResults
            //      The results of the query, extended with iterative methods.

            queryOptions = {};
            if (options) {
                if (options.start) {
                    queryOptions.offset = options.start;
                }
                if (options.count) {
                    queryOptions.limit = options.count;
                }
                if (options.sort) {
                    queryOptions.order = array.map(options.sort, function (item) {
                        var prefix = item.descending ? '-' : '';
                        return prefix + item.attribute;
                    }).join(',');
                }
            }
            var fn = this.api.list(queryOptions);
            var results = this._execute(fn).then(function (response) {
                var items = response.items || [];
                if ('count' in response) {
                    items.total = response.count;
                }
                else {
                    items.total = items.length;
                    items.total += queryOptions.offset || 0;
                    if ('nextPageToken' in response) {
                        items.total += items.length;
                    }
                }
                items.nextPageToken = response.nextPageToken;
                return items;
            });
            var total = results.then(function (items) {
                return items.total;
            });
            results.total = 0; // Prevent QueryResults from setting total
            results = QueryResults(results);
            results.total = total;
            return results;
        }
    });
});
