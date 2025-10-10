/**
 * 浏览器指纹收集脚本
 * 用于收集浏览器特征信息，增强风控检测
 */

class BrowserFingerprint {
  constructor() {
    this.fingerprint = {};
    this.init();
  }

  /**
   * 初始化指纹收集
   */
  init() {
    this.collectBasicInfo();
    this.collectBrowserFeatures();
    this.collectScreenInfo();
    this.collectTimezone();
    this.collectLanguage();
    this.collectCanvasFingerprint();
    this.collectWebGLFingerprint();
  }

  /**
   * 收集基础信息
   */
  collectBasicInfo() {
    this.fingerprint.userAgent = navigator.userAgent;
    this.fingerprint.platform = navigator.platform;
    this.fingerprint.language = navigator.language;
    this.fingerprint.languages = navigator.languages;
    this.fingerprint.cookieEnabled = navigator.cookieEnabled;
    this.fingerprint.onLine = navigator.onLine;
    this.fingerprint.doNotTrack = navigator.doNotTrack;
  }

  /**
   * 收集浏览器特征
   */
  collectBrowserFeatures() {
    this.fingerprint.features = {
      // 基础API支持
      localStorage: this.isSupported('localStorage'),
      sessionStorage: this.isSupported('sessionStorage'),
      indexedDB: this.isSupported('indexedDB'),
      webGL: this.isSupported('webgl'),
      webGL2: this.isSupported('webgl2'),
      webRTC: this.isSupported('webRTC'),
      webAudio: this.isSupported('webAudio'),
      geolocation: this.isSupported('geolocation'),
      notification: this.isSupported('notification'),
      serviceWorker: this.isSupported('serviceWorker'),
      
      // 媒体支持
      audio: this.isSupported('audio'),
      video: this.isSupported('video'),
      canvas: this.isSupported('canvas'),
      svg: this.isSupported('svg'),
      webp: this.isSupported('webp'),
      
      // 其他特性
      touch: this.isSupported('touch'),
      pointer: this.isSupported('pointer'),
      hover: this.isSupported('hover'),
      flexbox: this.isSupported('flexbox'),
      grid: this.isSupported('grid')
    };
  }

  /**
   * 收集Canvas指纹
   */
  collectCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        this.fingerprint.canvasFingerprint = null;
        return;
      }

      // 设置canvas尺寸
      canvas.width = 200;
      canvas.height = 50;

      // 绘制文本
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('BrowserFingerprint', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('BrowserFingerprint', 4, 17);

      // 绘制几何图形
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgb(255,0,255)';
      ctx.beginPath();
      ctx.arc(50, 50, 50, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgb(0,255,255)';
      ctx.beginPath();
      ctx.arc(100, 50, 50, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgb(255,255,0)';
      ctx.beginPath();
      ctx.arc(75, 100, 50, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.fill();

      // 获取指纹
      this.fingerprint.canvasFingerprint = canvas.toDataURL();
    } catch (e) {
      this.fingerprint.canvasFingerprint = null;
    }
  }

  /**
   * 收集WebGL指纹
   */
  collectWebGLFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) {
        this.fingerprint.webglFingerprint = null;
        return;
      }

      const webglInfo = {
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION),
        shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        extensions: gl.getSupportedExtensions(),
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
        maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
        maxVaryingVectors: gl.getParameter(gl.MAX_VARYING_VECTORS),
        aliasedLineWidthRange: gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE),
        aliasedPointSizeRange: gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE),
        maxCombinedTextureImageUnits: gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
        maxVertexTextureImageUnits: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
        maxTextureImageUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
        maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
        maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)
      };

      this.fingerprint.webglFingerprint = JSON.stringify(webglInfo);
    } catch (e) {
      this.fingerprint.webglFingerprint = null;
    }
  }

  /**
   * 收集字体信息（简化版）
   */
  collectFonts() {
    const fonts = [];
    const testString = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const testSize = '72px';
    const baseFonts = [
      'Arial', 'Helvetica', 'Times New Roman', 'Courier New',
      'Verdana', 'Georgia', 'Palatino', 'Garamond'
    ];

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = testSize + ' monospace';
    const baselineWidth = context.measureText(testString).width;

    baseFonts.forEach(font => {
      context.font = testSize + ' ' + font + ', monospace';
      const width = context.measureText(testString).width;
      if (width !== baselineWidth) {
        fonts.push(font);
      }
    });

    this.fingerprint.fonts = fonts;
  }

  /**
   * 收集插件信息（简化版）
   */
  collectPlugins() {
    const plugins = [];
    if (navigator.plugins && navigator.plugins.length > 0) {
      for (let i = 0; i < Math.min(navigator.plugins.length, 5); i++) {
        plugins.push(navigator.plugins[i].name);
      }
    }
    this.fingerprint.plugins = plugins;
  }

  /**
   * 收集屏幕信息
   */
  collectScreenInfo() {
    this.fingerprint.screen = {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      devicePixelRatio: window.devicePixelRatio || 1
    };

    this.fingerprint.viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };
  }

  /**
   * 收集时区信息
   */
  collectTimezone() {
    this.fingerprint.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    this.fingerprint.timezoneOffset = new Date().getTimezoneOffset();
  }

  /**
   * 收集语言信息
   */
  collectLanguage() {
    this.fingerprint.language = navigator.language;
    this.fingerprint.languages = navigator.languages;
  }

  /**
   * 检查API支持
   */
  isSupported(feature) {
    const features = {
      localStorage: () => typeof Storage !== 'undefined',
      sessionStorage: () => typeof Storage !== 'undefined',
      indexedDB: () => 'indexedDB' in window,
      webgl: () => {
        try {
          const canvas = document.createElement('canvas');
          return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch (e) {
          return false;
        }
      },
      webgl2: () => {
        try {
          const canvas = document.createElement('canvas');
          return !!canvas.getContext('webgl2');
        } catch (e) {
          return false;
        }
      },
      webRTC: () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      webAudio: () => !!(window.AudioContext || window.webkitAudioContext),
      geolocation: () => 'geolocation' in navigator,
      notification: () => 'Notification' in window,
      serviceWorker: () => 'serviceWorker' in navigator,
      pushManager: () => 'PushManager' in window,
      audio: () => {
        const audio = document.createElement('audio');
        return !!(audio.canPlayType && audio.canPlayType('audio/mpeg').replace(/no/, ''));
      },
      video: () => {
        const video = document.createElement('video');
        return !!(video.canPlayType && video.canPlayType('video/mp4').replace(/no/, ''));
      },
      canvas: () => {
        try {
          const canvas = document.createElement('canvas');
          return !!(canvas.getContext && canvas.getContext('2d'));
        } catch (e) {
          return false;
        }
      },
      svg: () => {
        try {
          return !!(document.createElementNS && document.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGRect);
        } catch (e) {
          return false;
        }
      },
      webp: () => {
        const canvas = document.createElement('canvas');
        return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
      },
      avif: () => {
        const canvas = document.createElement('canvas');
        return canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0;
      },
      touch: () => 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      pointer: () => 'onpointerdown' in window,
      hover: () => window.matchMedia('(hover: hover)').matches,
      flexbox: () => CSS.supports('display', 'flex'),
      grid: () => CSS.supports('display', 'grid'),
      cssTransforms: () => CSS.supports('transform', 'translateX(1px)'),
      cssTransitions: () => CSS.supports('transition', 'all 1s'),
      cssAnimations: () => CSS.supports('animation', 'name 1s')
    };

    return features[feature] ? features[feature]() : false;
  }

  /**
   * 获取完整指纹
   */
  getFingerprint() {
    return this.fingerprint;
  }

  /**
   * 发送指纹到服务器
   */
  sendFingerprint(url) {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    
    // 设置实际可用的自定义头
    xhr.setRequestHeader('X-Screen-Resolution', `${screen.width}x${screen.height}`);
    xhr.setRequestHeader('X-Viewport-Width', window.innerWidth);
    xhr.setRequestHeader('X-Viewport-Height', window.innerHeight);
    xhr.setRequestHeader('X-Device-Pixel-Ratio', window.devicePixelRatio || 1);
    xhr.setRequestHeader('X-Color-Depth', screen.colorDepth);
    xhr.setRequestHeader('X-Pixel-Depth', screen.pixelDepth);
    xhr.setRequestHeader('X-Timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
    
    // 只发送实际可用的指纹信息
    if (this.fingerprint.canvasFingerprint) {
      xhr.setRequestHeader('X-Canvas-Fingerprint', this.fingerprint.canvasFingerprint);
    }
    if (this.fingerprint.webglFingerprint) {
      xhr.setRequestHeader('X-WebGL-Fingerprint', this.fingerprint.webglFingerprint);
    }
    if (this.fingerprint.fonts && this.fingerprint.fonts.length > 0) {
      xhr.setRequestHeader('X-Fonts', JSON.stringify(this.fingerprint.fonts));
    }
    if (this.fingerprint.plugins && this.fingerprint.plugins.length > 0) {
      xhr.setRequestHeader('X-Plugins', JSON.stringify(this.fingerprint.plugins));
    }
    
    // WebGL信息
    const webglVendor = this.getWebGLVendor();
    const webglRenderer = this.getWebGLRenderer();
    const webglVersion = this.getWebGLVersion();
    
    if (webglVendor) xhr.setRequestHeader('X-WebGL-Vendor', webglVendor);
    if (webglRenderer) xhr.setRequestHeader('X-WebGL-Renderer', webglRenderer);
    if (webglVersion) xhr.setRequestHeader('X-WebGL-Version', webglVersion);
    
    xhr.send(JSON.stringify(this.fingerprint));
  }

  /**
   * 获取WebGL供应商
   */
  getWebGLVendor() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return gl ? gl.getParameter(gl.VENDOR) : '';
    } catch (e) {
      return '';
    }
  }

  /**
   * 获取WebGL渲染器
   */
  getWebGLRenderer() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return gl ? gl.getParameter(gl.RENDERER) : '';
    } catch (e) {
      return '';
    }
  }

  /**
   * 获取WebGL版本
   */
  getWebGLVersion() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return gl ? gl.getParameter(gl.VERSION) : '';
    } catch (e) {
      return '';
    }
  }
}

// 自动初始化并发送指纹
if (typeof window !== 'undefined') {
  const fingerprint = new BrowserFingerprint();
  
  // 将指纹添加到全局对象
  window.browserFingerprint = fingerprint;
  
  // 自动发送指纹（如果需要）
  if (window.autoSendFingerprint) {
    fingerprint.sendFingerprint(window.autoSendFingerprint);
  }
}

// 导出类（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BrowserFingerprint;
}
