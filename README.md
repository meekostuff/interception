Interception
============

Adapt your web-site from within the browser by *intercepting* 
page loading (including the landing page), hyperlink clicks and form submission.

Interception is intended to be a starting point for other frameworks.

**WARNING:** This project is still experimental. 
Expect the APIs to change and the documentation to be out-of-date.

**DO NOT USE IN PRODUCTION**


Overview
--------

The goal of Interception is facilitating the separation of content from user-interface.

With Interception you can put all stylesheets and scripts (and potentially banner, site navigation and footer) into one separate and shared HTML document. This shared document is called the **viewer-page**. The viewer page must include the interception **runner-script**. This script overrides normal browser navigation so that content is presented as if it was contained in the viewer page. 

Styles and scripts from content pages are also stripped before merging into the viewer page, so they can be used for fallback when Interception is not supported.

The implementation of all this is fairly straight-forward, with the exception of handling the landing-page. Every content page must include the interception **boot-script** which will *redirect* the browser to the viewer page (assuming the browser supports Interception and scripting is enabled).

### Browser support

Interception requires features only available in recent versions of popular browsers. 
It will not even attempt to start on unsupported browsers
so the fallback behavior of pages is simply defined by their own styles and scripts 
rather than the viewer page. 

Interception can run on browsers which support `history.pushState`, native `XMLHttpRequest` and (for now) native `Promise`.
These are available on recent versions of browsers in significant use today,
except that Promises are not available on IE - they are only implemented in Edge.

### License

Interception is available under 
[MPL 2.0](http://www.mozilla.org/MPL/2.0/ "Mozilla Public License version 2.0").
See the [MPL 2.0 FAQ](http://www.mozilla.org/MPL/2.0/FAQ.html "Frequently Asked Questions")
for your obligations if you intend to modify or distribute Interception or part thereof. 

### Contact

If you have any questions or comments, don't hesitate to contact the author via
[web](http://meekostuff.net/), [email](mailto:shogun70@gmail.com) or [twitter](http://twitter.com/meekostuff). 


Installation
------------

1. Copy or clone the Interception project files to a sub-directory of your domain on your server, say 
	
		path/to/interception/

2. Open a **supported** browser and navigate to the following page
	
		http://your.domain.com/path/to/interception/test/normal.html
	
	Visually inspect the displayed page for the following possible failures:
	
	- text indicating that it is from the viewer page
	- **TODO:** the test-pages are minimally useful
	
3. Create a viewer page with styles and scripts but no content.
Source the Interception runner-script with this line in the `<head>`
	
		<script src="/path/to/interception/runner.js"></script>
		
	The runner-script 
	- MUST be in the `<head>` of the page
	- MUST NOT have `@async` or `@defer`
	- MUST be before any scripts
	- MUST be before any stylesheets - `<link rel="stylesheet" />` or `<style>`

4. Source the Interception boot-script into your pages with this line in the `<head>` of each page 
	
		<script src="/path/to/interception/boot.js"></script>
		
	The boot-script 
	- MUST be in the `<head>` of the page
	- MUST NOT have `@async` or `@defer`
	- MUST be before any scripts
	- MUST be before any stylesheets - `<link rel="stylesheet" />` or `<style>`

More details in [Boot Configuration](#boot-configuration).


Quick Start
-----------

Create a HTML document (page.html) with some page specific content. 
Any page specific scripts, styles or meta-data should go in `<head>`. 

    <!DOCTYPE html>
	<html manifest="/viewer.html"><!-- @manifest is the link to the viewer page -->
	<head>
		<!-- source the Interception boot-script -->
		<script src="/path/to/interception/boot.js"></script>
		<title>Page One</title>
		<!-- include fallback stylesheets for when Interception doesn't run. -->
		<style>
		.styled-from-page { background-color: red; color: white; }
		</style>
	</head>
	<body>

		<main><!-- Primary content -->
			<h1>Page One<h1>
			<div class="styled-from-viewer">
			This content is styled by the viewer stylesheet
			</div>	
			<div class="styled-from-page">
			This content is styled by the page stylesheet which will not apply in the viewer. 
			</div>	
		</main>
		
	</body>
	</html>
	
Create the viewer document (viewer.html).
This is a normal page of HTML that, when viewed in the browser,
will appear as the final page without the page specific content. 

	<!DOCTYPE html>
	<html>
	<head>
		<!-- source the Interception runner-script -->
		<script src="/path/to/interception/runner.js"></script>
		<style>
		.styled-from-viewer { border: 2px solid blue; }
		</style>
	</head>
	<body>
	</body>
	</html>

When page.html is loaded into the browser, Interception will redirect to viewer.html and then load and merge page.html using AJAX,
replacing the `<body>` of viewer.html with that of page.html.

This process results in a DOM tree something like this:

	<!DOCTYPE html>
	<html>
	<head>
		<!-- source the Interception runner-script -->
		<script src="/path/to/interception/runner.js"></script>
		<title>Page One</title>
		<style>
		.styled-from-viewer { border: 2px solid blue; }
		</style>
		<!-- NOTE: no page specific style -->
	</head>
	<body>

		<main><!-- Primary content -->
			<h1>Page One<h1>
			<div class="styled-from-viewer">
			This content is styled by the viewer stylesheet
			</div>	
			<div class="styled-from-page">
			This content is styled by the page stylesheet which will not apply in the viewer. 
			</div>	
		</main>

	</body>
	</html>


Boot Configuration
------------------

### Preparation

Assuming the default [installation](#installation) was successful,
use these steps to prepare for site specific configuration.

1. Copy `viewer.html` from the interception directory to the root directory of your domain.

	If you have unix shell access to the domain's server 

			cd /directory/of/your/domain
			cp path/to/interception/viewer.html .
	
2. Edit the viewer page to source the interception runner-script, replacing this line
	
		<script src="runner.js"></script>
	
	with this line

		<script src="/path/to/interception/runner.js"></script>
	
3. Copy `options.js` from the interception directory to the root directory of your domain.
	
			cp path/to/interception/options.js .

4. Concatenate your modified `options.js` with `boot.js` from the interception directory
and store in `boot.js` of the root directory.
	
			cat options.js path/to/interception/boot.js > boot.js

5. Source the modified interception boot-script into your pages -
preferably before any stylesheets - 
with this line in the `<head>` of each page 
	
			<script src="/boot.js"></script>


Now you have a simple setup allowing you to:

- modify your options without affecting the interception installation, and
- update interception without overwriting your options.

When you want to:

+ modify options
	- edit your copy of `options.js`
	- repeat step 4 to rebuild your boot-script

+ update interception
	- overwrite the interception directory with the latest version
	- repeat step 4

+ minify boot.js
	- minify boot.js to boot.min.js in the path/to/interception directory
	- repeat step 4 with `path/to/interception/boot.min.js`


### Boot options

The boot-script has the following options (default values in **bold**).

- no_boot: **false**, true
- no_style: **false**, true
- no_intercept: **false**, true
- html5\_block\_elements: **"article aside figcaption figure footer header hgroup main nav section"**
- html5\_inline\_elements: **"abbr mark output time audio video picture"**
- viewer_url: ""

Sources for options are detailed below. 


#### From `Meeko.options`

**NOTE:** this is how options are set in `options.js`.  
Options can be **preset** by script, like this:

    <script>
	var Meeko = window.Meeko || (window.Meeko = {});
	Meeko.options = {
		viewer_url: '/path/to/viewer.html'
	};
	</script>

This tells interception to
- use '/path/to/viewer.html' as the viewer page for this page

#### From localStorage and sessionStorage
When debugging a page you probably don't want to modify the page source to change interception options,
especially as you may have to change them back after you've found the problem.
For this reason interception reads `sessionStorage` and `localStorage` at startup, looking for config options.
`sessionStorage` options override those found in `localStorage`, which in turn override those in data-attributes.

Config options are read from JSON stored in the `Meeko.options` key. Thus the following would force interception to use an alternate viewer page, probably for testing purposes.

	sessionStorage.setItem(
		'Meeko.options', 
		JSON.stringify({ 
			viewer_url: '/path/to/new_viewer.html'
		}) 
	);

_Note_ that the page would require a refresh after these settings were made.



