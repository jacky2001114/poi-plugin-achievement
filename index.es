import React, {Component} from 'react'
import {connect} from 'react-redux'

import {join} from 'path'
import {readJsonSync, ensureDirSync} from 'fs-extra'
import {Row} from 'react-bootstrap'

import SenkaCalculator from './views/calculator'
import SenkaCalendar, {drawChart} from './views/calendar'
import SenkaInfo from './views/info'

/*
import {
  pluginDidLoad,
  pluginWillUnload,
} from './mananger'
*/

import {
  getDateNo,getRankDateNo,
  fs,exlist,exvalue,dayofMonth,MAGIC_L_NUMS,MAGIC_R_NUMS,
  findSenkaMagicNum,
} from './lib/util'

import {
  mainUISelector,
} from './selectors'

import { debug } from './debug'

// make sure the directory exists and return file path to achieve.json
const getAchieveFilePath = () => {
  const {APPDATA_PATH} = window
  const path = join(APPDATA_PATH,'achieve')
  ensureDirSync(path)
  return join(path,'achieve.json')
}

const mkInitState = props => ({
  achieve: {
    exphis: {},
  },
  exphis: {},
  lastmonth: -1,
  r1: 0,
  r501: 0,
  ranktime: 0,
  rankuex:exlist,
  r1time: 0,
  r501time: 0,
  r1last: 0,
  r501last: 0,
  r1lasttime: 0,
  r501lasttime: 0,

  r5:0,
  r5time:0,
  r5last:0,
  r5lasttime:0,
  r20:0,
  r20time:0,
  r20last:0,
  r20lasttime:0,

  r5his:{},
  r20his:{},
  r100his:{},
  r501his:{},

  myhis:{},

  mylastno:0,
  mylastranktime:0,

  mymagic:MAGIC_L_NUMS[props.basic?props.basic.api_member_id:0],
  tmpexp:0,
  tmpno:0,
  reviseType: 0, /* revise */

  mysenka: 0,
  targetsenka: 2400,
  ignoreex: {},
  need_load: true,
  fensureexp: 0,
  fensurets: 0,
  fensuresenka: 0,
  tensureexp:0,
  tensurets:0,
  tensureuex:exlist,
  fensureuex:exlist,
  zcleartslist: [0,0,0,0,0,0,0],
  extraSenkalist: [1,1,1,1,1,1,1],
  zId: [854,888,893,666666,284,666666,666666],
  zValue: [350,200,300,400,80,330,390],
  zName: ['Z作战前','三川','泊地警戒','Z作戦後','海上警備','西方','六水戦'],
  checksum:484764,  //2017.6.5

  senkaType:'calendar',
  chartType: 'mon',
})

export const reactClass = connect(
  mainUISelector,
  null, null, {pure: false}
)(class PluginAchievement extends Component {
  constructor(props) {
    super(props)
    this.state = mkInitState(props)
  }

  componentWillReceiveProps(nextProps){
    const basic = nextProps.basic
    const exp = basic.api_experience
    const now = new Date()

    let month = now.getMonth();
    let date = now.getDate();
    if(dayofMonth[month-1]==date){
      
    }

    const no = getDateNo(now)
    const achieve = {}
    const data = this.loadlist()
    let exphistory = data.exphis
    const lastmonth = data.lastmonth
    let needupdate=false
    if(month!=lastmonth){
      exphistory={}
      achieve.exphis={}
      achieve.lastmonth=month
      achieve.fensureexp=0
      achieve.fensurets=0
      achieve.fensuresenka=0
      achieve.fensureuex=exlist
      achieve.r1=0
      achieve.r501=0
      achieve.r5=0
      achieve.r20=0
      achieve.mysenka=0
      achieve.rankuex=exlist
      achieve.extraSenkalist=[1,1,1,1,1,1,1]
      achieve.zcleartslist=[0,0,0,0,0,0,0]
      achieve.zId=[854,888,893,666666,284,666666,666666], // I don't know some of the request Id of senka mission
      achieve.zValue=[350,200,300,400,80,330,390],
      achieve.zName=['Z作战前','三川','泊地警戒','Z作戦後','海上警備','西方','六水戦']
      achieve.r5his={}
      achieve.r20his={}
      achieve.r100his={}
      achieve.r501his={}
      achieve.myhis={}
      needupdate=true
    }
    if(!exphistory[no]){
      if(!exphistory[data.tmpno+1]){
        if(no>data.tmpno){
          exphistory[data.tmpno+1]=data.tmpexp
        }
      }
      exphistory[no]=exp
      achieve.exphis=exphistory
      needupdate=true
    }
    if(exp>data.tmpexp||exp<data.tmpexp-10000){
      if(now.getDate()==dayofMonth[month]){
        const Hour = now.getHours()
        const rem = now.getTime()%86400000
        if(rem<46800000||rem>57600000){
          achieve.tmpexp=exp
          achieve.tmpno=no
          needupdate=true
        }
      }else{
        achieve.tmpexp=exp
        achieve.tmpno=no
        needupdate=true
      }
    }
    if(needupdate){
      this.setState(achieve,()=>{
        drawChart(data.chartType, data.senkaType, {
          r5his: data.r5his,
          r20his: data.r20his,
          r100his: data.r100his,
          r501his: data.r501his,
          myhis: data.myhis,
        })
        this.savelist()
      })
    }
  }


  starttimer(){
    let now = new Date()
    const left = (43200000-(now.getTime()-18001000)%43200000)
    console.log('will start record exp after '+(left/3600000).toFixed(1)+' hours');
    setTimeout(() =>{
      const exp = this.props.basic.api_experience
      const nowtime = new Date()
      const unclearedex = this.props.unclearedExList
      const achieve = {tensureexp:exp,tensurets:nowtime,tensureuex:unclearedex}
      this.setState(achieve,()=>{
        this.savelist()
        setTimeout(()=>{
          this.starttimer()
        },600000)
      })
    },left)
  }

  getRate(rankNo, obfsRate, memberId) {
    const mymagic = this.state.mymagic>9?this.state.mymagic:MAGIC_L_NUMS[memberId % 10]
    const rate = obfsRate / MAGIC_R_NUMS[rankNo % 13] / mymagic - 73 - 18
    return rate > 0 ? rate : 0
  }

  handleResponse = e => {
    const {path, body,postBody} = e.detail

    /*for test only!

    if(path=="/kcsapi/api_req_quest/start"){
      this.setState({extraSenka:2,zclearts:new Date()});
    }
    if(path=="/kcsapi/api_req_quest/stop"){
      this.setState({extraSenka:1,zclearts:0});
    }

    */

    const now = new Date()
    if(path=="/kcsapi/api_req_quest/clearitemget"){
      requestId = this.state.zId.indexOf(postBody.api_request_id)
      if(requestId>-1){
        let es = this.state.extraSenkalist.slice()
        let zcts = this.state.zcleartslist.slice()
        es[requestId] = 2

        if(now.getDate()==1&&now.getHours()<4){
          this.setState({extraSenkalist:es})
        }else{
          zcts[requestId] = new Date()
          this.setState({extraSenkalist:es,zcleartslist:zcts})
        }
      }
    }
    if(path=="/kcsapi/api_req_ranking/mxltvkpyuklh"){
      const myname = this.props.basic.api_nickname
      const myid = this.props.basic.api_member_id
      const achieve = this.state
      const page = body.api_disp_page
      const list = body.api_list
      const tensurets = achieve.tensurets

      const sum = this.props.shipChecksum
      const checksum = this.state.checksum
      if(sum>0&&sum!=checksum){
        achieve.reviseType=0
        achieve.checksum=sum
      }
      if(achieve.reviseType==0){
        debug.log('checksum failed,will refresh magic')
        const newmagic = findSenkaMagicNum(list)
        if (newmagic){
          achieve.mymagic=newmagic
          achieve.reviseType=1
          debug.log("newmagic:"+newmagic)
        }
      }
      for(let i=0;i<list.length;i++){
        if(list[i].api_mtjmdcwtvhdr === myname){
          const no=list[i].api_mxltvkpyuklh
          const key = list[i].api_wuhnhojjxmke
          const senka = this.getRate(no,key,myid)
          const timeno = getRankDateNo(now)
          achieve.myhis[timeno]=senka
          achieve.mysenka=senka
          achieve.mylastno=achieve.myno
          achieve.mylastranktime=getRankDateNo(achieve.ranktime)
          achieve.myno=no
          const then = achieve.ranktime
          if(getRankDateNo(now)>getRankDateNo(new Date(then))){
            achieve.rankuex = this.props.unclearedExList
          }
          achieve.ranktime = now
          const sub = now.getTime()-new Date(tensurets).getTime()
          const dateno = getRankDateNo(now)
          if(sub>3600000+30000&&sub<3600000*13-30000){
            achieve.fensuresenka=senka
            achieve.fensurets=achieve.tensurets
            achieve.fensureuex=achieve.tensureuex
            achieve.fensureexp=achieve.tensureexp
            achieve.exphis[dateno] = achieve.tensureexp
          }else{
            const ensuresenka=achieve.fensuresenka
            const ensureexp = achieve.fensureexp
            const ensureuex = achieve.fensureuex
            if(ensuresenka>0&&ensureexp>0){
              const thenexp = ensureexp
              const thensenka = ensuresenka
              const senkauex = this.props.unclearedExList
              const addexsenka = this.addExSenka(senkauex,ensureuex)
              if(addexsenka==0){
                const subsenka = (senka-thensenka-addexsenka)*50000/35
                if(subsenka>0){
                  const senkaexp = thenexp + subsenka
                  if(senkaexp<=achieve.tmpexp+4500){
                    achieve.exphis[dateno] = senkaexp
                  }
                }
              }
            }
          }
        }
      }

      const trackingRanks = [100,501,5,20]
      trackingRanks.map(rank => {
        const pg = Math.ceil(rank/10)
        if (pg !== page)
          return

        const offset =
          rank % 10 === 0 ? 9 :
            rank % 10 - 1

        const no=list[offset].api_mxltvkpyuklh
        const key = list[offset].api_wuhnhojjxmke
        const senka = this.getRate(no,key,myid)
        const prefix = rank === 100 ? `r1` : `r${rank}`
        const rXlast = achieve[prefix]
        const rXtime = achieve[`${prefix}time`]
        const rXtimeno = getRankDateNo(new Date(rXtime))
        achieve[prefix]=senka
        achieve[`${prefix}time`]=now
        const timeno = getRankDateNo(now)
        achieve[`r${rank}his`][timeno]=senka
        if(rXtimeno!=timeno){
          achieve[`${prefix}last`]=rXlast
          achieve[`${prefix}lasttime`]=rXtimeno
        }
      })
      this.setState(achieve,()=>this.savelist())
    }
  }

  componentDidMount = () => {
    window.addEventListener('game.response', this.handleResponse)
    this.loadlist()

  };

  componentWillUnmount = () => {
    window.removeEventListener('game.response', this.handleResponse)
  };

  savelist(){
    try {
      const data = this.loadlist()
      const savepath = getAchieveFilePath()
      fs.writeFileSync(savepath, JSON.stringify(data))
    } catch (e) {
      debug.error(`error while saving data`, e)
    }
  }

  loadlist() {
    const needload = this.state.need_load
    if (needload) {
      try {
        const savedpath = getAchieveFilePath()
        const data = readJsonSync(savedpath)
        data.need_load = false
        const zcts = data.zcleartslist.slice()
        let zcts2 = data.zcleartslist.slice()
        zcts.forEach((ts, index) => {
          if(new Date(ts).getDate()==1&&new Date(ts).getHours()<6){
            zcts2[index]=0
          }
        })
        data.zcleartslist = zcts2
        if(new Date().getDate()>2&&new Date().getDay()<20){
          delete(data.exphis[58])
          delete(data.exphis[59])
          delete(data.exphis[60])
          delete(data.exphis[61])
          delete(data.exphis[62])
        }
        this.setState(data,() => {
          this.starttimer()
          if (typeof data.exphis !== 'undefined' &&
              typeof data.tmpexp !== 'undefined')
            drawChart(data.chartType, data.senkaType, {
              r5his: data.r5his,
              r20his: data.r20his,
              r100his: data.r100his,
              r501his: data.r501his,
              myhis: data.myhis,
            })
        })
        return data
      } catch (e) {
        return this.state
      }
    } else {
      return this.state
    }
  }

  addExSenka(uexnow,uexthen){
    const hash={}
    for (let i=0;i<uexnow.length;i++){
      hash[uexnow[i]]=1
    }
    let r=0
    for (let i=0;i<uexthen.length;i++){
      const map=uexthen[i]
      if(!hash[map]){
        r=r+exvalue[map]
      }
    }
    return r
  }

  render() {
    try {
      return this.render_D()
    } catch (e) {
      debug.log(e)
      return (
        <div>
          <div>
            {e.message}
          </div>
          <div>
            {e.stack}
          </div>
        </div>
      )
    }
  }

  render_D() {
    const achieve = this.state

    const ranktime =new Date(achieve.ranktime?achieve.ranktime:0)
    const mysenka = achieve.mysenka?achieve.mysenka:0
    const exp = this.state.tmpexp
    const no = getRankDateNo(ranktime)

    const unclearedex = this.props.unclearedExList
    const exphis = this.state.exphis
    let upsenka
    const ensuresenka=achieve.fensuresenka
    const ensureexp = achieve.fensureexp
    const ensureuex = achieve.fensureuex

    const zclearts = this.state.zcleartslist.slice()
    const zValue = this.state.zValue.slice()
    if(ensuresenka>0&&ensureexp>0){

      upsenka = (exp-ensureexp)/50000*35+ensuresenka-mysenka+this.addExSenka(unclearedex,ensureuex)
      zclearts.forEach((ts, index) => {
        if(new Date(ts).getTime()>new Date(this.state.fensurets).getTime()){
          upsenka = parseInt(upsenka) + parseInt(zValue[index])
        }
      })
    }else{
      upsenka = (exp - exphis[no])/50000*35 + this.addExSenka(unclearedex,this.state.rankuex)
      zclearts.forEach((ts, index) => {
        if(new Date(ts).getTime()>ranktime.getTime()){
          upsenka = parseInt(upsenka) + parseInt(zValue[index])
        }
      })
    }
    const ignoreex = this.state.ignoreex
    const maps = this.props.maps
    let senkaleft = this.state.targetsenka-mysenka-upsenka
    for(let i=0;i<unclearedex.length;i++){
      if(!ignoreex[unclearedex[i]]){
        senkaleft=senkaleft-exvalue[unclearedex[i]]
      }
    }
    const extraSenka = this.state.extraSenkalist.slice()
    extraSenka.forEach((item, index) => {
      if(item == 0){
        senkaleft=senkaleft-zValue[index]
      }
    })
    const layouttype = (this.props.layout=='vertical') && (this.props.doubleTabbed==false)

    return (
      <div id="achievement" className="achievement">
        <link rel="stylesheet" href={join(__dirname, 'assets/achievement.css')}/>
        <Row>
          <SenkaInfo
            achieve={achieve}
            upsenka={upsenka}
            member_id={this.props.basic.api_member_id}
            lt={layouttype}
            backstate={
              (newstate) => {
                this.setState(newstate)
              }
            }
          >
          </SenkaInfo>
          <SenkaCalculator
            senkaleft={senkaleft}
            targetsenka={this.state.targetsenka}
            ignoreex={ignoreex}
            maps={maps}
            zclearts={this.state.zcleartslist}
            extraSenka={this.state.extraSenkalist}
            zName={this.state.zName}
            lt={layouttype}
            backstate={
              (newstate) => {
                this.setState(newstate)
              }
            }
          >
          </SenkaCalculator>
          <SenkaCalendar
            exphis={exphis}
            tmpexp={this.state.tmpexp}
            tmpno={this.state.tmpno}
            chartType={this.state.chartType}
            senkaType={this.state.senkaType}
            senkaLine={{
              r5his: this.state.r5his,
              r20his: this.state.r20his,
              r100his: this.state.r100his,
              r501his: this.state.r501his,
              myhis: this.state.myhis,
            }}
            lt={layouttype}
            backstate={
              (newstate, callback) => {
                this.setState(newstate, callback)
              }
            }
          >
          </SenkaCalendar>
        </Row>
      </div>
    )
  }
})

const switchPluginPath = [
  '/kcsapi/api_req_ranking/mxltvkpyuklh',
]

export {
  switchPluginPath,
  // pluginDidLoad,
  // pluginWillUnload,
}
