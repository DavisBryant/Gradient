<template>
  <div class="k-line">
    <div class="resolution-group">
      <div style="width: 100%">
        <a v-for="(item, index) in resolutionJson" :key="index"
           @click="switchResolution(index)">{{item.text}}</a>
      </div>
      <span style="color: red;">{{activeResolution}}</span>
    </div>
    <div id="charting_container"></div>
  </div>
</template>

<script>
import * as TradingView from './../../../static/charting_library/charting_library.min'
import socket from './socket.js'
import Datafeeds from './datafees'
import {ResolutionJson} from './config/resolution'

export default {
  name: 'index',
  data () {
    return {
      // TV加载实例
      Widget: null,
      // TV数据层
      datafeeds: new Datafeeds(this),
      // socket引入
      socket: new socket(),
      // 分辨率配置
      resolutionJson: ResolutionJson,
      // 当前分辨率
      activeResolution: ResolutionJson[8],
      // 当前交易对
      symbol: 'ht_usdt',
      // 数据缓存占位
      cacheData: {},
      isHistory: {},
      lastTime: ''
    }
  },
  methods: {
    loadSymbol (symbol) {
      this.Widget.chart().setSymbol(symbol.replace('_', ':'))
    },
    /*
      * 切换分辨率， 重新请求TV socket数据
      * @params {*number 分辨率在分辨率配置中的序列号}
      * */
    /*eslint-disable*/
      switchResolution (index) {
        // 先停止订阅当前ws
        this.unSubscribe()
        setTimeout(() => {
          this.activeResolution = this.resolutionJson[index]
          this.Widget.chart().setResolution(this.activeResolution.resolution)
        }, 500)
      },

      /*
      * 发送socket订阅请求
      * @params {*object 请求入参, 参考socket api文档}
      * */
      sendMessage (obj) {
        if (this.socket.checkOpen()) {
          this.socket.send(obj)
        } else {
          this.socket.on('open', () => {
            this.socket.send(obj)
          })
        }
      },

      // socket返回数据
      onMessage (data) {
        let that = this
        // 缓存的key
        let ticker = that.symbol + '-' + that.activeResolution.resolution
        let tickerstate = ticker + '_state'
        if (data.records && data.records.length) {
          // websocket返回的值，数组代表时间段历史数据，不是增量
          let list = []
          let tickerCallback = ticker + '_Callback'
          let onLoadedCallback = that.cacheData[tickerCallback]

          // 遍历数组，构造缓存数据
          data.records.forEach((element) => {
            // 周线时间向后推一周
            if (that.activeResolution.resolution === 'W' || that.activeResolution.resolution === '1W') {
              element[0] = Number(element[0]) + (7 * 24 * 60 * 60)
            }
            // if (that.activeResolution.resolution === 'M' || that.activeResolution.resolution === '1M') {
            //   let time = new Date(Number(element[0]) * 1e3)
            //   let date = `${time.getFullYear()}/${time.getMonth() + 1}/01`
            //   element[0] = Math.round(new Date(date).getTime() / 1000).toString()
            //   console.log(element[0])
            // }
            list.push({
              time: Number(element[0]) * 1e3,
              open: Number(element[1]),
              high: Number(element[2]),
              low: Number(element[3]),
              close: Number(element[4]),
              volume: Number(element[5])
            })
          })

          // 如果没有缓存数据，则直接填充，发起订阅
          if (!that.cacheData[ticker]) {
            that.cacheData[ticker] = list
            that.subscribe()
          } else {
            that.cacheData[ticker] = list.concat(that.cacheData[ticker])
            that.isHistory.isRequestHistory = false
          }

          // 新数据即当前时间段需要的数据，直接喂给图表插件
          if (onLoadedCallback) {
            onLoadedCallback(that.cacheData[ticker])
            delete that.cacheData[tickerCallback]
          }
          // 请求完成，设置状态为false
          that.cacheData[tickerstate] = !1
          // 记录当前缓存时间，即数组最后一位的时间
          that.lastTime = that.cacheData[ticker][that.cacheData[ticker].length - 1].time
          // that.datafeeds.barsUpdater.updateData();

          if (data.records.length < 300) {
            this.isHistory.isLoadAll = true
          } else {
            this.isHistory.isLoadAll = false
          }
        }

        // 增量数据
        if (data.kbar && typeof data.kbar === 'object') {
          // data带有type，即返回的是订阅数据，
          // 构造增量更新数据, Number类型，防止K线错乱
          let barsData = {
            time: Number(new Date(data.kbar.t).getTime()),
            open: Number(data.kbar.o),
            high: Number(data.kbar.h),
            low: Number(data.kbar.l),
            close: Number(data.kbar.c),
            volume: Number(data.kbar.v)
          }
          /* if (barsData.time >= thats.lastTime && thats.cacheData[ticker] && thats.cacheData[ticker].length) {
              thats.cacheData[ticker][thats.cacheData[ticker].length - 1] = barsData
          } */
          // 如果增量更新数据的时间大于缓存时间，而且缓存有数据，数据长度大于0
          if (barsData.time > that.lastTime && that.cacheData[ticker] && that.cacheData[ticker].length) {
            // 增量更新的数据直接加入缓存数组
            that.cacheData[ticker].push(barsData)
            // 修改缓存时间
            that.lastTime = barsData.time
          } else if (barsData.time === that.lastTime && that.cacheData[ticker] && that.cacheData[ticker].length) {
            // 如果增量更新的时间等于缓存时间，即在当前时间颗粒内产生了新数据，更新当前数据
            that.cacheData[ticker][that.cacheData[ticker].length - 1] = barsData
          }
        }

        // 通知图表插件，可以开始增量更新的渲染了
        that.datafeeds.barsUpdater.updateData()
      },

      // 发起订阅请求
      subscribe () {
        this.sendMessage({
          'action': 'subscribe',
          'subscribe': 'kbar',
          'kbar': this.activeResolution.parameter,
          'pair': this.symbol
        })
      },

      // 停止订阅
      unSubscribe () {
        // 停止订阅，删除过期缓存、缓存时间、缓存状态
        let ticker = this.symbol + '-' + this.activeResolution.resolution
        let tickerstate = ticker + '_state'
        let tickerCallback = ticker + 'Callback'
        delete this.cacheData[ticker]
        delete this.cacheData[tickerstate]
        delete this.cacheData[tickerCallback]
        this.sendMessage({
          'action': 'unsubscribe',
          'subscribe': 'kbar',
          'kbar': this.activeResolution.parameter,
          'pair': this.symbol
        })
      },

      initMessage (symbolInfo, resolution, rangeStartDate, rangeEndDate, onLoadedCallback, mask) {
        var that = this
        // 保留当前回调
        let ticker = this.symbol + '-' + resolution
        var tickerCallback = ticker + '_Callback'
        that.cacheData[tickerCallback] = onLoadedCallback
        // 如果当前时间节点已经改变，停止上一个时间节点的订阅，修改时间节点值
        if (that.activeResolution.resolution !== resolution) {
          that.unSubscribe()
          that.activeResolution.resolution = resolution
        }
        // 获取当前时间段的数据，在onMessage中执行回调onLoadedCallback
        let params = {
          'action': 'request',
          'request': 'reqkbar',
          'kbar': this.activeResolution.parameter,
          'pair': this.symbol,
          'start': '',
          'end': mask && mask === 'history' ? Math.floor(this.isHistory.endTime / 1e3).toString() : Math.floor(new Date().getTime() / 1e3).toString(),
          'size': '300'
        }
        this.sendMessage(params)
      },

      // TV商品数据解析回调
      getBars (symbolInfo, resolution, rangeStartDate, rangeEndDate, onLoadedCallback) {
        rangeStartDate = rangeStartDate.toString().length > 10 ? rangeStartDate : rangeStartDate * 1e3
        rangeEndDate = rangeEndDate.toString().length > 10 ? rangeEndDate : rangeEndDate * 1e3
        this.interval = resolution
        let ticker = `${this.symbol}-${resolution}`
        let tickerstate = `${ticker}_state`
        let tickerload = `${ticker}_load`
        this.cacheData[tickerload] = rangeStartDate
        // 如果缓存没有数据，而且未发出请求，记录当前节点开始时间
        // 切换时间或币种
        if (!this.cacheData[ticker] && !this.cacheData[tickerstate]) {
          this.cacheData[tickerload] = rangeStartDate
          // 发起请求，从websocket获取当前时间段的数据
          this.initMessage(symbolInfo, resolution, rangeStartDate, rangeEndDate, onLoadedCallback)
          // 设置状态为true
          this.cacheData[tickerstate] = true
        }
        if (!this.cacheData[tickerload] || this.cacheData[tickerload] > rangeStartDate) {
          // 如果缓存有数据，但是没有当前时间段的数据，更新当前节点时间
          this.cacheData[tickerload] = rangeStartDate
          // 发起请求，从websocket获取当前时间段的数据
          this.initMessage(symbolInfo, resolution, rangeStartDate, rangeEndDate, onLoadedCallback)
          // 设置状态为true
          this.cacheData[tickerstate] = !0
        }
        // 正在从websocket获取数据，禁止一切操作
        if (this.cacheData[tickerstate]) {
          return false
        }
        // 拿到历史数据，更新图表
        if (this.cacheData[ticker] && this.cacheData[ticker].length > 1) {
          this.isLoading = false
          onLoadedCallback(this.cacheData[ticker])
        } else {
          let self = this
          this.getBarTimer = setTimeout(function () {
            self.getBars(symbolInfo, resolution, rangeStartDate, rangeEndDate, onLoadedCallback)
          }, 10)
        }
        // 加载结束后
        if (this.isHistory.isLoadAll) {
          onLoadedCallback([])
          return false
        }
        // 这里很重要，画圈圈----实现了往前滑动，分次请求历史数据，减小压力
        // 根据可视窗口区域最左侧的时间节点与历史数据第一个点的时间比较判断，是否需要请求历史数据
        if (this.cacheData[ticker] && this.cacheData[ticker].length > 1 && this.Widget && this.Widget._ready && !this.isHistory.isRequestHistory && !this.isHistory.isLoadAll) {
          const rangeTime = this.Widget.chart().getVisibleRange() // 可视区域时间值(秒) {from, to}
          const dataTime = this.cacheData[ticker][0].time // 返回数据第一条时间
          if (rangeTime.from * 1000 <= dataTime + 28800000) { // true 不用请求 false 需要请求后续
            this.isHistory.endTime = dataTime
            this.isHistory.isRequestHistory = true
            // 发起历史数据的请求
            this.initMessage(symbolInfo, resolution, rangeStartDate, rangeEndDate, onLoadedCallback, 'history')
          }
        }
      },

      // 加载tradingview实例
      loadCharting () {
        if (!this.Widget) {
          /* eslint-disable */
          this.Widget = new TradingView.widget({
            autosize: true,
            symbol: this.symbol,
            interval: this.activeResolution.resolution,
            container_id: 'charting_container',
            datafeed: this.datafeeds,
            library_path: '/static/charting_library/',
            timezone: 'Asia/Hong_Kong', // 时区
            locale: 'zh',
            debug: false,
            custom_css_url: '/static/charting_library/dark.css',
            toolbar_bg: '#1f242f', // toolbar
            loading_screen: {backgroundColor: '#1E232F', foregroundColor: '#1E232F'}, // 加载动画背景色
            plotColor: '#fff',
            disabled_features: [
              'save_chart_properties_to_local_storage',
              'volume_force_overlay',
              'go_to_date',
              'header_compare',
              'header_resolutions',
              'header_screenshot',
              'header_symbol_search',
              'study_dialog_search_control',
              'symbol_search_hot_key',
              'header_undo_redo',
              'legend_context_menu',
              'show_hide_button_in_legend',
              'show_interval_dialog_on_key_press',
              'snapshot_trading_drawings',
              'symbol_info',
              'timeframes_toolbar',
              'use_localstorage_for_settings',
              'volume_force_overlay',
              'study_buttons_in_legend',
              'header_saveload',
              'header_chart_type',
              'header_settings',
              'header_fullscreen_button',
              // 改版
              'header_indicators',
              'adaptive_logo',
              // "move_logo_to_main_pane",
              // "study_templates",
              'dont_show_boolean_study_arguments',
              'hide_last_na_study_output',
              'same_data_requery',
              'side_toolbar_in_fullscreen_mode',
              // 隐藏顶部栏
              'header_widget'
            ],
            enabled_features: [
              // 'header_indicators',
              // 'adaptive_logo',
              // // "move_logo_to_main_pane",
              // // "study_templates",
              // "dont_show_boolean_study_arguments",
              // "hide_last_na_study_output",
              // "same_data_requery",
              // "side_toolbar_in_fullscreen_mode",
            ],
            overrides: {
              'paneProperties.background': '#1E232F', // 图表背景色
              // "mainSeriesProperties.style": 0,
              // "symbolWatermarkProperties.color": "#fff",
              // "volumePaneSize": "tiny",
              // volumePaneSize: "medium",
              // "scalesProperties.lineColor": '#ff160c',  //坐标轴的颜色
              // "scalesProperties.textColor": '#ff8ec5',  //坐标轴文字颜色、开高低收和商品标示的颜色
              'paneProperties.vertGridProperties.color': 'rgba(93,101,118,.3)', // 网格纵轴的颜色#5D6576
              'paneProperties.horzGridProperties.color': 'rgba(93,101,118,.3)', // 网格横轴的颜色
              'paneProperties.crossHairProperties.color': 'rgba(169,175,202,.4)', // 移动十字线虚线的颜色
              // "paneProperties.legendProperties.showLegend": false,  //默认是否显示开高低收旁边的名称
              'paneProperties.legendProperties.showStudyArguments': true, // 是否显示Volume的参数
              'paneProperties.legendProperties.showStudyTitles': true, // 是否显示Volume的名字
              // "paneProperties.legendProperties.showStudyValues": false,//是否显示Volume的值
              'paneProperties.legendProperties.showSeriesTitle': false, // 是否需要显示开高低收旁边的名称
              // "paneProperties.legendProperties.showSeriesOHLC": false,  //是否需要开高低收
              'mainSeriesProperties.candleStyle.upColor': '#2AA76D', // 涨柱状线的颜色
              'mainSeriesProperties.candleStyle.downColor': '#DF553A', // 跌柱状线的颜色
              'mainSeriesProperties.candleStyle.wickUpColor': '#2AA76D', // 涨柱状线上下细线颜色
              'mainSeriesProperties.candleStyle.wickDownColor': '#DF553A'// 跌柱状线上下细线颜色
              // "mainSeriesProperties.candleStyle.drawWick": true,  //柱状图上下的细线
              // "mainSeriesProperties.candleStyle.drawBorder": false,  //柱状图是否要边框
              // "mainSeriesProperties.candleStyle.borderUpColor": '#ff813a',  //涨柱状线边框颜色
              // "mainSeriesProperties.candleStyle.borderDownColor": t.down,  //跌柱状线边框颜色
              // "mainSeriesProperties.candleStyle.borderColor": '#f730e4',
              // "mainSeriesProperties.candleStyle.barColorsOnPrevClose": true,
              // "mainSeriesProperties.hollowCandleStyle.upColor": '#f730e4', //可能是辅助线
              // "mainSeriesProperties.hollowCandleStyle.downColor": 'yellow', //可能是辅助线
              // "mainSeriesProperties.hollowCandleStyle.drawWick": false,  //可能是辅助线
              // "mainSeriesProperties.hollowCandleStyle.drawBorder": true, //可能是辅助线
            },
            studies_overrides: {
              'volume.volume.color.0': '#DF553A',
              'volume.volume.color.1': '#2AA76D',
              'volume.volume.transparency': 70,
              // "volume.volume ma.color": "#FF0000",
              'volume.volume ma.transparency': 30,
              'volume.volume ma.linewidth': 5,
              'volume.show ma': false,
              'bollinger bands.median.color': '#33FF88',
              'bollinger bands.upper.linewidth': 7
            },
            favorites: {
              intervals: ['1', '5', '15', '30', '60', '240', 'D', 'W', 'M'],
              chartTypes: ['Area', 'Line']
            },
            customFormatters: {
              timeFormatter: {
                format: function (date) {
                  let h = date.getUTCHours() < 10 ? `0${date.getUTCHours()}` : date.getUTCHours()
                  let m = date.getUTCMinutes() < 10 ? `0${date.getUTCMinutes()}` : date.getUTCMinutes()
                  let s = date.getUTCSeconds() < 10 ? `0${date.getUTCSeconds()}` : date.getUTCSeconds()
                  return h + ':' + m
                }
              },
              dateFormatter: {
                format: (date) => {
                  let m = date.getUTCMonth() + 1 < 10 ? `0${date.getUTCMonth() + 1}` : date.getUTCMonth() + 1
                  let d = ''
                  if (this.activeResolution.resolution === 'M') {
                    d = '01'
                  } else {
                    d = date.getUTCDate() < 10 ? `0${date.getUTCDate()}` : date.getUTCDate()
                  }
                  return date.getUTCFullYear() + '-' + m + '-' + d
                }
              }
            }
          })
        }
      }
    },
    mounted () {
      this.loadCharting()
    },
    created () {
      this.socket.doOpen()

      this.socket.on('message', this.onMessage)
      this.socket.on('close', this.onClose)
    }
  }
</script>

<style scoped>
  .k-line {
    width: 1000px;
    height: 600px;
    margin: 0 auto;
  }

  .resolution-group {
    text-align: left;
    padding-left: 40px;
  }

  .resolution-group a {
    line-height: 40px;
    margin-right: 20px;
    cursor: pointer;
  }

  #charting_container {
    width: 100%;
    height: 100%;
    background: #ccc;
  }
</style>
