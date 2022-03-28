// https://github.com/pubkey/broadcast-channel
class LeaderElection {
  constructor(name) {
    this.channel = new BroadcastChannel(name)
    // 是否已经存在 leader
    this.hasLeader = false
    // 是否自己作为 leader
    this.isLeader = false

    // token 数，用于无 leader 时同时有多个 apply 的情况，来比对 maxTokenNumber 确定最大的作为 leader
    this.tokenNumber = Math.random()
    // 最大的 token，用于无 leader 时同时有多个 apply 的情况，来选举一个最大的作为 leader
    this.maxTokenNumber = 0
    this.channel.onmessage = (evt) => {
      console.log('channel onmessage', evt.data)
      const action = evt.data.action
      switch (action) {
        // 收到申请拒绝，或者是其他人已成为 leader 的宣告，则标记 this.hasLeader = true
        case 'applyReject':
          this.hasLeader = true
          break;
        case 'leader':
          // todo， 可能会产生另一个 leader
          this.hasLeader = true
          break;
        // leader 已死亡，则需要重新推举
        case 'death':
          this.hasLeader = false
          this.maxTokenNumber = 0
          // this.awaitLeadership()
          break;
        // leader 已死亡，则需要重新推举
        case 'apply':
          if (this.isLeader) {
            this.postMessage('applyReject')
          } else if (this.hasLeader) {
          } else if (evt.data.tokenNumber > this.maxTokenNumber) {
            // 还没有 leader 时，若自己 tokenNumber 比较小，那么记录 maxTokenNumber，
            // 将在 applyOnce 的过程中，撤销成为 leader 的申请。
            this.maxTokenNumber = evt.data.tokenNumber
          }
          break;
        default:
          break;
      }
    }
  }
  awaitLeadership() {
    return new Promise((resolve) => {
      const intervalApply = () => {
        return this.sleep(4000)
          .then(() => {
            return this.applyOnce()
          })
          .then(() => resolve())
          .catch(() => intervalApply())
      }
      this.applyOnce()
        .then(() => resolve())
        .catch(err => intervalApply())
    })
  }
  applyOnce(timeout = 1000) {

    return this.postMessage('apply').then(() => this.sleep(timeout))
      .then(() => {
        if (this.isLeader) {
          return
        }
        if (this.hasLeader === true || this.maxTokenNumber > this.tokenNumber) {
          throw new Error()
        }
        return this.postMessage('apply').then(() => this.sleep(timeout))
      })
      .then(() => {
        if (this.isLeader) {
          return
        }
        if (this.hasLeader === true || this.maxTokenNumber > this.tokenNumber) {
          throw new Error()
        }
        // 两次尝试后无人阻止，晋升为 leader
        this.beLeader()
      })
    
  }
  beLeader () {
    this.postMessage('leader')
    this.isLeader = true
    this.hasLeader = true
    clearInterval(this.timeout)
    window.addEventListener('beforeunload', () => this.die());
    /**
     * iframe 使用 unload 事件
     * @link https://stackoverflow.com/q/47533670/3443137
     */
    window.addEventListener('unload', () => this.die());
  }
  die () {
    this.isLeader = false
    this.hasLeader = false
    this.postMessage('death')
  }
  postMessage(action) {
    return new Promise((resolve) => {
      this.channel.postMessage({
        action,
        tokenNumber: this.tokenNumber
      })
      resolve()
    })
  }
  sleep(time) {
    if (!time) time = 0;
    return new Promise(res => setTimeout(res, time));
  }
}


const elector = new LeaderElection('test_channel')
window.elector = elector
elector.awaitLeadership().then(() => {
  document.title = 'leader!'
})