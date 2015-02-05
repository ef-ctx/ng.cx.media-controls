(function (angular) {
    'use strict';

    var module = angular.module('ng.cx.media-controls', ['ng.cx.media-controls.templates']);

    /**
     * @ngdoc directive
     * @name ng.cx.media-controls.directive:cxAudioMini
     *
     * @description
     * Minimal, one button, audio player.
     */
    module.directive('cxAudioMini', [
        '$rootScope',
        'generateGuid',
        function cxAudioMini($rootScope, generateGuid) {

            return {
                scope: {
                    asset: '=cxAudioMini'
                },
                restrict: 'A',
                templateUrl: 'components/media/audio-mini.tpl.html',
                replace: 'element',
                link: function ($scope) {
                    var mediaElement = angular.element(document.createElement('audio'));
                    var mediaGuid = generateGuid();
                    var media = mediaElement[0];

                    function getSourceTags() {
                        var sourceTags = '';
                        var files = $scope.asset.files;

                        for (var i = files.length - 1; i >= 0; i--) {
                            sourceTags = sourceTags + '<source src="' + files[i].url + '" type="' + files[i].mime_type.toLowerCase() + '">';
                        }

                        return sourceTags;
                    }

                    mediaElement.attr('preload', '');
                    mediaElement.attr('buffered', '');
                    $scope.isPlaying = false;
                    $scope.mediaLoaded = false;

                    mediaElement.on('playing', function () {
                        $scope.$evalAsync(function () {
                            $scope.isPlaying = true;
                            $rootScope.$broadcast('cxMedia.playStarted', mediaGuid);
                        });
                    });

                    mediaElement.on('pause', function () {
                        media.currentTime = 0;
                        $scope.$evalAsync(function () {
                            $scope.isPlaying = false;
                        });
                    });

                    mediaElement.on('error', function () {
                        media.currentTime = 0;
                        $scope.$evalAsync(function () {
                            $scope.isPlaying = false;
                        });
                    });

                    mediaElement.on('loadeddata', function (evt) {
                        $scope.$evalAsync(function () {
                            $scope.mediaLoaded = true;
                        });
                    });

                    mediaElement.on('ended', function (evt) {
                        media.currentTime = 0;
                        $scope.$evalAsync(function () {
                            $scope.isPlaying = false;
                        });
                    });

                    mediaElement.html(getSourceTags());
                    media.load();

                    $scope.$on('cxMedia.playStarted', function (evt, data) {
                        if (data !== mediaGuid && $scope.isPlaying) {
                            media.pause();
                        }
                    });

                    $scope.$on('state.pauseMedia', function () {
                        if ($scope.isPlaying) {
                            media.pause();
                        }
                    });

                    $scope.$on('state.mute', function () {
                        media.muted = true;
                    });

                    $scope.$on('state.unmute', function () {
                        media.muted = false;
                    });

                    $scope.playOrStop = function () {
                        if (!$scope.isPlaying) {
                            media.play();
                        } else {
                            media.pause();
                        }
                    };
                }
            };
        }
    ]);

    /**
     * @ngdoc directive
     * @name ng.cx.media-controls.directive:cxMediaControls
     *
     * @description
     * Media control bar for audio/video.
     */
    module.directive('cxMediaControls', [
        '$rootScope',
        '$timeout',
        'generateGuid',
        'browser',
        function cxMediaControls($rootScope, $timeout, generateGuid, browser) {

            return {
                scope: {
                    asset: '=cxMediaControls'
                },
                restrict: 'A',
                templateUrl: 'components/media/media-controls.tpl.html',
                replace: 'element',
                link: function ($scope, $element) {
                    var mediaElement;
                    var media;
                    var mediaGuid = generateGuid();
                    var trackProgress = true;
                    var autoFadeOutEnabled = false;
                    var mouseOver = false;
                    var isIOS = browser.isIOS();
                    var hidePromise = null;

                    var handleMouseEnter = function () {
                        mouseOver = true;
                        show();
                    };

                    var handleMouseLeave = function () {
                        mouseOver = false;
                        scheduleHide();
                    };

                    function scheduleHide() {
                        if (autoFadeOutEnabled && !mouseOver) {
                            cancelHide();
                            hidePromise = $timeout(hide, 3000);
                        }
                    }

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

                    function getSourceTags() {
                        var sourceTags = '';
                        var files = $scope.asset.files;

                        for (var i = files.length - 1; i >= 0; i--) {
                            sourceTags = sourceTags + '<source src="' + files[i].url + '" type="' + files[i].mime_type.toLowerCase() + '">';
                        }

                        return sourceTags;
                    }

                    function bind(mediaElement) {
                        mediaElement.on('playing', function () {
                            $scope.$evalAsync(function () {
                                $scope.isPlaying = true;
                                $rootScope.$broadcast('cxMedia.playStarted', mediaGuid);
                                scheduleHide();
                            });
                        });

                        mediaElement.on('pause', function () {
                            $scope.$evalAsync(function () {
                                $scope.isPlaying = false;
                                show();
                            });
                        });

                        mediaElement.on('error', function () {
                            $scope.seek(0);
                            $scope.$evalAsync(function () {
                                $scope.isPlaying = false;
                                $scope.playbackProgress = 0;
                                $scope.updateProgressBar();
                                show();
                            });
                        });

                        mediaElement.on('timeupdate', function () {
                            if (trackProgress) {
                                $scope.$evalAsync(function () {
                                    $scope.playbackProgress = media.currentTime;
                                    $scope.updateProgressBar();
                                });
                            }
                        });

                        mediaElement.on('loadeddata', function () {
                            $scope.$evalAsync(function () {
                                $scope.mediaLoaded = true;
                                $scope.mediaDuration = Math.floor(media.duration);
                            });
                        });

                        mediaElement.on('loadedmetadata', function () {
                            $scope.$evalAsync(function () {
                                $scope.metadataLoaded = true;
                                $scope.mediaDuration = Math.floor(media.duration);
                            });
                        });

                        mediaElement.on('ended', function () {
                            $scope.seek(0);
                            $scope.$evalAsync(function () {
                                $scope.isPlaying = false;
                                $scope.playbackProgress = 0;
                                $scope.updateProgressBar();
                                show();
                            });
                        });
                    }

                    $scope.isPlaying = false;
                    $scope.mediaLoaded = false;
                    $scope.metadataLoaded = false;
                    $scope.playbackProgress = 0;
                    $scope.playbackProgressPercentage = 0;
                    $scope.mediaDuration = 0;

                    // for audio assets, the asset is passed through the scope and an audio element is created
                    if (angular.isObject($scope.asset)) {
                        $scope.mediaIsVideo = false;
                        mediaElement = angular.element(document.createElement('audio'));
                        media = mediaElement[0];
                        mediaElement.attr('preload', '');
                        mediaElement.attr('buffered', '');

                        bind(mediaElement);

                        mediaElement.html(getSourceTags());
                        media.load();
                    }
                    // for video assets, the video element passed by the parent scope with an emit 'cxMedia.bind'
                    else {
                        // @todo: add buffering bar - media.buffered.end(0);
                        $scope.mediaIsVideo = true;
                        $scope.$on('cxMedia.bind', function (evt, videoElement) {
                            mediaElement = videoElement;
                            media = mediaElement[0];

                            bind(mediaElement);
                        });
                    }

                    $scope.pauseProgressTracking = function () {
                        cancelHide();
                        trackProgress = false;
                    };

                    if (isIOS) {
                        var $progressBar = $element.find('input');
                        $progressBar.on('touchstart', function () {
                            $scope.pauseProgressTracking();
                        });
                        $progressBar.on('touchend', function () {
                            $scope.seek($scope.playbackProgress);
                        });
                    }

                    $scope.updateProgressBar = function () {
                        var percentage = parseInt((($scope.playbackProgress / $scope.mediaDuration) * 100));
                        $scope.playbackProgressPercentage = isNaN(percentage) ? 0 : Math.min(100, percentage);
                    };

                    $scope.seek = function (time) {
                        trackProgress = true;

                        media.currentTime = time;

                        if ($scope.isPlaying) {
                            scheduleHide();
                        }
                    };

                    $scope.$on('cxMedia.playStarted', function (evt, guid) {
                        if (guid !== mediaGuid && $scope.isPlaying) {
                            media.pause();
                        }
                    });

                    $scope.$on('state.pauseMedia', function () {
                        if ($scope.isPlaying) {
                            media.pause();
                        }
                    });

                    $scope.$on('state.mute', function () {
                        media.muted = true;
                    });

                    $scope.$on('state.unmute', function () {
                        media.muted = false;
                    });

                    // Account for zoom behaviours if this media control is being used for video
                    if ($scope.mediaIsVideo) {
                        $scope.$on('cxMediaControls.enableAutoFadeOut', function () {
                            autoFadeOutEnabled = true;

                            if ($scope.isPlaying) {
                                scheduleHide();
                            }

                            $element.bind('mouseenter', handleMouseEnter);
                            $element.bind('mouseleave', handleMouseLeave);
                        });

                        $scope.$on('cxMediaControls.disableAutoFadeOut', function () {
                            autoFadeOutEnabled = false;

                            $element.unbind('mouseenter', handleMouseEnter);
                            $element.unbind('mouseleave', handleMouseLeave);

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

                    $scope.togglePlayback = function () {
                        if (!$scope.isPlaying) {
                            media.play();
                        } else {
                            media.pause();
                        }
                    };
                }
            };
        }
    ]);

})(angular);

