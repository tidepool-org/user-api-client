// Loads the environment and makes it accessible,
// and also has sensible defaults

// == BSD2 LICENSE ==
// Copyright (c) 2014, Tidepool Project
// 
// This program is free software; you can redistribute it and/or modify it under
// the terms of the associated License, which is identical to the BSD 2-Clause
// License as published by the Open Source Initiative at opensource.org.
// 
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE. See the License for more details.
// 
// You should have received a copy of the License along with this program; if
// not, you can obtain one from Tidepool Project at tidepool.org.
// == BSD2 LICENSE ==

var fs = require('fs');

function maybeReplaceWithContentsOfFile(obj, field)
{
  var potentialFile = obj[field];
  if (potentialFile != null && fs.existsSync(potentialFile)) {
    obj[field] = fs.readFileSync(potentialFile).toString();
  }
}

'use strict';
module.exports = (function() {
  var env = {};

  env.logName = process.env.LOG_NAME || 'userapiclient';

  // Shared secret for servers, keep it safe!
  env.serverSecret = process.env.SERVER_SECRET;
  if (env.serverSecret == null) {
    throw new Error('Must specify a SERVER_SECRET in your environment.');
  }

  // The host to contact for discovery
  if (process.env.DISCOVERY_HOST != null) {
    env.discovery = {};
    env.discovery.host = process.env.DISCOVERY_HOST;
  }

  env.userApiService = process.env.USER_API_SERVICE;
  if (env.serverSecret == null) {
    throw new Error('Must specify a USER_API_SERVICE in your environment.');
  }

  return env;
})();
