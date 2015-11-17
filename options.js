/* START Interception boot options */

/*
This code MUST run before the boot-script.
  EITHER
Prepend this code to the boot-script (for performance)
  OR 
Source this file into the page before sourcing the boot-script (to simplify reconfiguration)
*/

var Meeko = window.Meeko || {};
Meeko.options = { // NOTE defaults also define the type of the associated config option
	"no_boot": false, // a debugging option. Abandon boot immediately. 
	"no_intercept": false, // use feature / browser detection to abandon the initial redirect
	"no_style": false, // a demo option. `no_intercept` plus remove all stylesheets. 
	"precheck": false, // TODO false, "auto", true, "strict"
	"hidden_timeout": 3000,
	"html5_block_elements": 'article aside figcaption figure footer header hgroup main nav section',
	"html5_inline_elements": 'abbr mark output time audio video picture',
	"viewer_url": ''
};

/* END Interception boot options */
