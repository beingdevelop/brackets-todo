define(function (require, exports) {
    'use strict';

    // Get dependencies.
    var FileUtils = brackets.getModule('file/FileUtils'),
        FileSystem = brackets.getModule('filesystem/FileSystem'),
        PreferencesManager = brackets.getModule('preferences/PreferencesManager'),
        Defaults = require('modules/Defaults'),
        Events = require('modules/Events'),
        SettingsDialog = require('modules/SettingsDialog'),
        settings = Defaults.defaultSettings,

        // Preferences.
        preferences = PreferencesManager.getExtensionPrefs('mikaeljorhult.bracketsTodo'),

        visibleFiles,
        visibleTags;

    // Define preferences.
    preferences.definePreference('enabled', 'boolean', false);
    preferences.definePreference('visibleFiles', 'object', []);
    preferences.definePreference('visibleTags', 'object', {});
    preferences.definePreference('userSettings', 'object', {});

    // All files are not visible by default.
    visibleFiles = preferences.get('visibleFiles');
    visibleTags = preferences.get('visibleTags');

    /**
     * Check for settings file, settings from setting dialog and load if it exists.
     * settings priority:
     *  settings in .todo file > settings seted by settings dialog > default settings
     */
    function loadSettings(callback) {
        var ProjectManager = brackets.getModule('project/ProjectManager'),
            projectRoot = ProjectManager.getProjectRoot(),
            fileEntry = FileSystem.getFileForPath(projectRoot.fullPath + '.todo'),
            fileContent = FileUtils.readAsText(fileEntry),
            userSettings = {},
            todoFile = false;

        // File is loaded asynchronous.
        fileContent.done(function (content) {
            // Catch error if JSON is invalid
            try {
                //.todo file exists.
                todoFile = true;

                // Parse .todo file.
                userSettings = JSON.parse(content);
            } catch (e) {
                // .todo exists but isn't valid JSON.
                todoFile = false;
            }
        }).fail(function () {
            // .todo doesn't exists or couldn't be accessed.
            todoFile = false;
        }).always(function () {
            // load settings from setting dialog if no .todo file
            if (!todoFile) {
                userSettings = getUserSettings();
            }

            // Merge default settings with JSON.
            mergeSettings(userSettings);

            // Build array of tags and save to preferences.
            setUpTags();

            // Trigger callback.
            if (callback) {
                callback();
            }

            // Publish event.
            Events.publish('settings:loaded');
        });
    }

    function mergeSettings(userSettings) {
        settings = jQuery.extend(true, {}, Defaults.defaultSettings, userSettings);

        // Replace, don't merge, array of tags if present in user settings.
        if (userSettings.tags !== undefined && Object.prototype.toString.call(userSettings.tags) === '[object Array]') {
            settings.tags = userSettings.tags;
        }

        return settings;
    }

    function getSettings() {
        return settings;
    }

    /**
     * save and reload settings 
     */
    function setUserSettings(newSettings) {
        preferences.set('userSettings', newSettings);
        preferences.save();

        // reload settings again.
        loadSettings();
    }

    function getUserSettings() {
        return preferences.get('userSettings');
    }

    /**
     * use .todo file settings or default settings to show if no user settings before
     */
    function showSettingsDialog() {
        var userSettings = getUserSettings();
        if ( userSettings === null || userSettings === undefined || Object.keys( userSettings ).length === 0 ) {
            userSettings = getSettings();
        }
        SettingsDialog.showDialog( userSettings, function (newSettings) {
            setUserSettings(newSettings);
        } );
    }

    /**
     * Return if file should be expanded or not.
     */
    function fileVisible(path) {
        return (settings.search.scope === 'project' ? visibleFiles.indexOf(path) > -1 : true);
    }

    /**
     * Toggle if file should be expanded or not.
     */
    function toggleFileVisible(path, state) {
        var alreadyVisible = fileVisible(path);

        // Check if already visible if visibility not provided as parameter.
        state = (state === undefined ? !alreadyVisible : state);

        // Toggle visibility state.
        if (state) {
            // Show if already visible.
            if (!alreadyVisible) {
                visibleFiles.push(path);
            }
        } else {
            // Hide if already visible.
            if (alreadyVisible) {
                visibleFiles.splice(visibleFiles.indexOf(path), 1);
            }
        }

        // Save visibility state.
        preferences.set('visibleFiles', visibleFiles);
        preferences.save();
    }


    function clearVisibleFiles() {
        visibleFiles = [];
    }

    function setUpTags() {
        // Build array of tags and save to preferences.
        visibleTags = initTags();
        preferences.set('visibleTags', visibleTags);
        preferences.save();
    }

    /**
     * Initialize tags according to settings's tags.
     * If user have not set the tag's visibility, all tags are visible by default.
     */
    function initTags() {
        var tagArray = {};

        // Build an array of possible tags.
        $.each(settings.tags, function (index, tag) {
            tag = tag.replace(/[^a-zA-Z]/g, '');

            tagArray[tag.toLowerCase()] = {
                tag: tag.toLowerCase(),
                name: tag,
                count: 0,
                visible: true
            };
        });

        return tagArray;
    }

    /** 
     * Check if tag is visible.
     * @return boolean True if tag is visible, otherwise false.
     */
    function isTagVisible(tag) {
        var visible = false;

        // Check if tag exists and use that value.
        if (visibleTags.hasOwnProperty(tag)) {
            visible = visibleTags[tag].visible;
        }

        return visible;
    }

    function getVisibleTags() {
        return visibleTags;
    }

    /**
     * Toggle tag visibility.
     */
    function toggleTagVisible(tag, state) {
        var visible = (state !== undefined ? state : isTagVisible(tag));

        // Toggle visibility state.
        if (visibleTags.hasOwnProperty(tag)) {
            visibleTags[tag].visible = visible;
        }

        // Save visibility state.
        preferences.set('visibleTags', visibleTags);
        preferences.save();
    }

    function isExtensionEnabled() {
        return preferences.get('enabled');
    }

    function setExtensionEnabled(enabled) {
        preferences.set('enabled', enabled);
        preferences.save();
    }

    // APIs about settings
    exports.loadSettings = loadSettings;
    exports.getSettings = getSettings;
    exports.showSettingsDialog = showSettingsDialog;

    // APIs about visible file
    exports.fileVisible = fileVisible;
    exports.toggleFileVisible = toggleFileVisible;
    exports.clearVisibleFiles = clearVisibleFiles;

    // APIs about visible tag
    exports.isTagVisible = isTagVisible;
    exports.getVisibleTags = getVisibleTags;
    exports.toggleTagVisible = toggleTagVisible;

    // APIs about Extension 
    exports.isExtensionEnabled = isExtensionEnabled;
    exports.setExtensionEnabled = setExtensionEnabled;

});