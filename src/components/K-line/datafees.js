/**
 * JS API
 */
import dataUpdater from './dataUpdater'
class datafeeds {
  /**
   * JS API
   * @param {*Object} vue vue实例
   */
  constructor (vue) {
    this.self = vue
    this.barsUpdater = new dataUpdater(this)
  }

  /**
   * @param {*Function} callback  回调函数
   * `onReady` should return result asynchronously.
   */
  onReady (callback) {
    return new Promise((resolve, reject) => {
      // 规避iframe闪白
      document.getElementById(this.self.Widget._id).style.display = 'block'
      let configuration = this.defaultConfiguration()
      if (this.self.getConfig) {
        configuration = Object.assign(this.defaultConfiguration(), this.self.getConfig())
      }
      resolve(configuration)
    }).then(data => callback(data))
  }

  /**
   * @param {*String} symbolName  商品名称或ticker
   * @param {*Function} onSymbolResolvedCallback 成功回调
   * @param {*Function} onResolveErrorCallback   失败回调
   * `resolveSymbol` should return result asynchronously.
   */
  resolveSymbol (symbolName, onSymbolResolvedCallback, onResolveErrorCallback) {
    return new Promise((resolve, reject) => {
      // 规避iframe闪白
      let loading = document.getElementById(this.self.Widget._id).contentWindow.document.getElementById('loading-indicator')
      loading.style.display = 'block'
      setTimeout(() => {
        loading.style.display = 'none'
      }, 1000)
      let symbolInfo = this.defaultSymbol()
      if (this.self.getSymbol) {
        symbolInfo = Object.assign(this.defaultSymbol(), this.self.getSymbol())
      }
      resolve(symbolInfo)
    }).then(data => onSymbolResolvedCallback(data)).catch(err => onResolveErrorCallback(err))
  }

  /**
   * @param {*Object} symbolInfo  商品信息对象
   * @param {*String} resolution  分辨率
   * @param {*Number} rangeStartDate  时间戳、最左边请求的K线时间
   * @param {*Number} rangeEndDate  时间戳、最右边请求的K线时间
   * @param {*Function} onDataCallback  回调函数
   * @param {*Function} onErrorCallback  回调函数
   */
  getBars (symbolInfo, resolution, rangeStartDate, rangeEndDate, onDataCallback, onErrorCallback) {
    this.self.getBars(symbolInfo, resolution, rangeStartDate, rangeEndDate, (data) => {
      if (data && data.length) {
        onDataCallback(data, { noData: false })
      } else {
        onDataCallback([], { noData: true })
      }
    })
  }

  /**
   * 订阅K线数据。图表库将调用onRealtimeCallback方法以更新实时数据
   * @param {*Object} symbolInfo 商品信息
   * @param {*String} resolution 分辨率
   * @param {*Function} onRealtimeCallback 回调函数
   * @param {*String} subscriberUID 监听的唯一标识符
   * @param {*Function} onResetCacheNeededCallback (从1.7开始): 将在bars数据发生变化时执行
   */
  subscribeBars (symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) {
    this.barsUpdater.subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback)
  }

  /**
   * 取消订阅K线数据
   * @param {*String} subscriberUID 监听的唯一标识符
   */
  unsubscribeBars (subscriberUID) {
    this.barsUpdater.unsubscribeBars(subscriberUID)
  }

  /**
   * 默认配置
   */
  defaultConfiguration () {
    return {
      supports_search: false,
      supports_group_request: false,
      supported_resolutions: ['1', '5', '15', '30', '60', '240', 'D', 'W', 'M'],
      supports_marks: true,
      supports_timescale_marks: true,
      supports_time: true
    }
  }

  /**
   * 默认商品信息
   */
  defaultSymbol () {
    return {
      'name': this.self.symbol.toLocaleUpperCase(),
      'timezone': 'Asia/Shanghai',
      'minmov': 1,
      'minmov2': 0,
      'pointvalue': 1,
      'fractional': false,
      // 设置周期
      'session': '24x7',
      'has_intraday': true,
      'has_no_volume': false,
      // 设置是否支持周月线
      'has_daily': true,
      // 设置是否支持周月线
      'has_weekly_and_monthly': true,
      'description': this.self.symbol.toLocaleUpperCase(),
      // 设置精度  100表示保留两位小数   1000三位   10000四位
      'pricescale': 100,
      'ticker': this.self.symbol.toLocaleUpperCase(),
      'supported_resolutions': ['1', '5', '15', '30', '60', '240', 'D', 'W', 'M']
    }
  }
}

export default datafeeds
