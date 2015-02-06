(function (angular) {
    'use strict';

    var module = angular.module('ng.cx.media-controls', [
        'ng.cx.media-controls.templates',
        'ng.cx.ua',
        'ng.cx.generate'
    ]);

    function getTypeFromFiles(files) {
        var extension;
        if (files.length && files[0].type) {
            return files[0].type.match(/^video/) ? 'video' : 'audio';
        }
        return 'audio';
    }

    function getTypeFromElement(element) {
        return 'audio';
    }

    function createMediaElement($window, $element, type, files) {
        var mediaElement = $window.document.createElement(type);
        var ix;
        mediaElement.setAttribute('preload', '');
        mediaElement.setAttribute('buffered', '');
        if (typeof files === 'string') {
            mediaElement.src = files;
        } else {
            for (ix = 0; ix < files.length; ix++) {
                if (mediaElement.canPlayType(files[ix].type)) {
                    mediaElement.src = files[ix].url;
                    break;
                }
            }
        }
        if (type === 'video') {
            $element.append(mediaElement);
        }
        return angular.element(mediaElement);
    }

    /**
     * nodoc internal service
     * @name ng.cx.media-controls.cxMediaControlLink
     *
     * @description
     * Media control bar for audio/video.
     */
    function link($rootScope, $window, $timeout, cxGenerate, cxUA) {

        return function ($scope, $element) {

            var $mediaElement;
            var mediaElement;
            var type; // audio/video
            var mediaGuid = cxGenerate.sequence('media');
            var trackProgress = true;
            var autoFadeOutEnabled = false;
            var mouseOver = false;
            var isIOS = cxUA.isIOS;
            var hidePromise = null;

            function cancelHide() {
                if (hidePromise !== null) {
                    $timeout.cancel(hidePromise);
                    hidePromise = null;
                }
            }

            function show() {
                cancelHide();
                $element.addClass('visible');
                $element.removeClass('hidden');
                $element.removeClass('hide-fast');
            }

            function hide(skipAnimation) {
                $element.removeClass('visible');
                $element.addClass('hidden');
                if (skipAnimation) {
                    $element.addClass('hide-fast');
                }
            }

            function scheduleHide() {
                if (autoFadeOutEnabled && !mouseOver) {
                    cancelHide();
                    hidePromise = $timeout(hide, 3000);
                }
            }

            var seek = function (time) {
                trackProgress = true;
                mediaElement.currentTime = time;
                if ($scope.isPlaying) {
                    scheduleHide();
                }
            };

            var togglePlayback = function () {
                if (!$scope.isPlaying) {
                    mediaElement.play();
                } else {
                    mediaElement.pause();
                }
            };

            var pauseProgressTracking = function () {
                cancelHide();
                trackProgress = false;
            };

            var updateProgressBar = function () {
                var percentage = parseInt(($scope.playbackProgress / $scope.mediaDuration) * 100);
                $scope.playbackProgressPercentage = isNaN(percentage) ? 0 : Math.min(100, percentage);
            };

            // -- user events

            var onMouseEnter = function () {
                mouseOver = true;
                show();
            };

            var onMouseLeave = function () {
                mouseOver = false;
                scheduleHide();
            };

            // -- media events

            var onMediaPlaying = function () {
                $scope.$evalAsync(function () {
                    $scope.isPlaying = true;
                    $rootScope.$broadcast('cxMedia.playStarted', mediaGuid);
                    scheduleHide();
                });
            };

            var onMediaPause = function () {
                $scope.$evalAsync(function () {
                    $scope.isPlaying = false;
                    show();
                });
            };

            var onMediaError = function () {
                seek(0);
                $scope.$evalAsync(function () {
                    $scope.isPlaying = false;
                    $scope.playbackProgress = 0;
                    $scope.updateProgressBar();
                    show();
                });
            };

            var onMediaTimeupdate = function () {
                if (trackProgress) {
                    $scope.$evalAsync(function () {
                        $scope.playbackProgress = mediaElement.currentTime;
                        $scope.updateProgressBar();
                    });
                }
            };

            var onMediaLoadeddata = function () {
                $scope.$evalAsync(function () {
                    $scope.mediaLoaded = true;
                    $scope.mediaDuration = Math.floor(mediaElement.duration);
                });
            };

            var onMediaLoadedmetadata = function () {
                $scope.$evalAsync(function () {
                    $scope.metadataLoaded = true;
                    $scope.mediaDuration = Math.floor(mediaElement.duration);
                });
            };

            var onMediaEnded = function () {
                seek(0);
                $scope.$evalAsync(function () {
                    $scope.isPlaying = false;
                    $scope.playbackProgress = 0;
                    $scope.updateProgressBar();
                    show();
                });
            };

            function bindMediaEvents($mediaElement) {
                $mediaElement.on('playing', onMediaPlaying);
                $mediaElement.on('pause', onMediaPause);
                $mediaElement.on('error', onMediaError);
                $mediaElement.on('timeupdate', onMediaTimeupdate);
                $mediaElement.on('loadeddata', onMediaLoadeddata);
                $mediaElement.on('loadedmetadata', onMediaLoadedmetadata);
                $mediaElement.on('ended', onMediaEnded);
            }

            // -- scope state

            $scope.isPlaying = false;
            $scope.mediaLoaded = false;
            $scope.mediaIsVideo = null;
            $scope.metadataLoaded = false;
            $scope.playbackProgress = 0;
            $scope.playbackProgressPercentage = 0;
            $scope.mediaDuration = 0;

            // -- scope watches

            $scope.$watch('files', function (files) {
                if (files) {

                    type = getTypeFromFiles(files);
                    $scope.mediaIsVideo = type === 'video';
                    $mediaElement = createMediaElement($window, $element, type, files);
                    mediaElement = $mediaElement[0];
                    bindMediaEvents($mediaElement);
                    mediaElement.load();
                }
            });

            $scope.$watch('element', function (element) {
                if (element && !$scope.files) {
                    type = getTypeFromElement(element);
                    $scope.mediaIsVideo = type === 'video';
                    $mediaElement = angular.element(element);
                    mediaElement = $mediaElement[0];
                    bindMediaEvents($mediaElement);
                }
            });

            // -- ?? why

            if (isIOS) {
                var $progressBar = $element.find('input');
                $progressBar.on('touchstart', function () {
                    $scope.pauseProgressTracking();
                });
                $progressBar.on('touchend', function () {
                    seek($scope.playbackProgress);
                });
            }

            // -- scope handlers

            $scope.pauseProgressTracking = pauseProgressTracking;
            $scope.updateProgressBar = updateProgressBar;
            $scope.seek = seek;
            $scope.togglePlayback = togglePlayback;

            // -- messaging

            $scope.$on('cxMedia.playStarted', function (evt, guid) {
                if (guid !== mediaGuid && $scope.isPlaying) {
                    mediaElement.pause();
                }
            });

            $scope.$on('state.pauseMedia', function () {
                if ($scope.isPlaying) {
                    mediaElement.pause();
                }
            });

            $scope.$on('state.mute', function () {
                mediaElement.muted = true;
            });

            $scope.$on('state.unmute', function () {
                mediaElement.muted = false;
            });

            if ($scope.mediaIsVideo) {
                $scope.$on('cxMediaControls.enableAutoFadeOut', function () {
                    autoFadeOutEnabled = true;

                    if ($scope.isPlaying) {
                        scheduleHide();
                    }

                    $element.bind('mouseenter', onMouseEnter);
                    $element.bind('mouseleave', onMouseLeave);
                });

                $scope.$on('cxMediaControls.disableAutoFadeOut', function () {
                    autoFadeOutEnabled = false;

                    $element.unbind('mouseenter', onMouseEnter);
                    $element.unbind('mouseleave', onMouseLeave);

                    show();
                });

                $scope.$on('cxMediaControls.show', function () {
                    show();
                    scheduleHide();
                });

                $scope.$on('cxMediaControls.hide', function (evt, skipAnimation) {
                    hide(skipAnimation);
                });
            }
        };
    }

    /**
     * @ngdoc directive
     * @name ng.cx.media-controls.directive:cxMediaControls
     *
     * @description
     * Media control bar for audio/video.
     */
    module.directive('cxMediaControls', [
        '$rootScope',
        '$window',
        '$timeout',
        'cxGenerate',
        'cxUA',
        function cxMediaControls($rootScope, $window, $timeout, cxGenerate, cxUA) {

            return {
                scope: {
                    files: '=cxMediaControls',
                    type: '=',
                    element: '='
                },
                restrict: 'A',
                templateUrl: 'lib/ng.cx.media-controls/media-controls.tpl.html',
                link: link($rootScope, $window, $timeout, cxGenerate, cxUA)
            };
        }
    ]);

    /**
     * @ngdoc filter
     * @name ng.cx.media-controls.filter:cxMediaDuration
     *
     * @description
     * Human readable duration.
     * - minimum unit is minutes
     * - maximum unit is hours
     * - defaults to '0:00' in case of bad input
     */
    module.filter('cxMediaDuration', function () {

        return function (value) {
            var output = '0:00';
            var hours = 0;
            var minutes = 0;
            var seconds = Math.round(parseFloat(value, 10));

            if (angular.isNumber(seconds) && seconds >= 0 && isFinite(seconds)) {
                hours = Math.floor(seconds / 3600);
                seconds = seconds % 3600;
                minutes = Math.floor(seconds / 60);
                seconds = seconds % 60;

                output = (hours > 0 ? hours + ':' : '') +
                    (hours > 0 && minutes < 10 ? '0' + minutes : minutes) +
                    ':' +
                    (seconds < 10 ? '0' + seconds : seconds);
            }

            return output;
        };

    });

})(angular);

