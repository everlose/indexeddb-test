class Database {
  constructor(options = {}) {
    if (typeof indexedDB === 'undefined') {
      throw new Error('indexedDB is unsupported!')
    }
    this.name = options.name
    this.db = null
    this.version = options.version || 1
    // this.upgradeFunction = option.upgradeFunction || function () {}
    this.modelsOptions = options.modelsOptions
    this.models = {}
  }

  createDB () {
    return new Promise((resolve, reject) => {
      indexedDB.deleteDatabase(this.name);
      const request = indexedDB.open(this.name);
      // 当数据库升级时，触发 onupgradeneeded 事件。升级是指该数据库首次被创建，或调用 open() 方法时指定的数据库的版本号高于本地已有的版本。
      request.onupgradeneeded = () => {
        const db = request.result;

        console.log('db onupgradeneeded')

        // 创建表，必须在这里开始。
        // 创建 log 表，id 为主键且自增。
        // db.createObjectStore('log', {
        //   keyPath: 'id',
        //   autoIncrement: true
        // });
        // this.createStore(db)
        Object.keys(this.modelsOptions).forEach(key => {
          this.models[key] = new Model(db, key, this.modelsOptions[key])
        })
      };

      // 打开成功
      request.onsuccess = () => {
        console.log('db open onsuccess')
        console.log('addLog, deleteLog, clearLog, putLog, getAllLog, getLog')
        resolve(request.result)
        this.db = request.result
      };
      // 打开失败
      request.onerror = function(event) {
        console.log('db open onerror', event);
        reject(event)
      }
    })
  }
}

class Model {
  db = null
  tableName = ''
  constructor(database, tableName, options) {
    this.db = database
    this.tableName = tableName

    if (!this.db.objectStoreNames.contains(tableName)) {
      const objectStore = this.db.createObjectStore(tableName, {
        keyPath: options.keyPath,
        autoIncrement: options.autoIncrement || false
      });
      options.index && Object.keys(options.index).forEach(key => {
        objectStore.createIndex(key, options.index[key]);
      })
    }
  }

  add(data) {
    return new Promise((resolve, reject) => {
      const db = this.db;
      const tableName = this.tableName;
      const transaction = db.transaction(tableName, 'readwrite')
      const store = transaction.objectStore(tableName)

      const request = store.add(data);
      // store.add({id: 2, time: new Date().getTime(), body: 'log 2' });

      request.onsuccess = function(event) {
        console.log('add onsuccess, affect rows ', event.target.result);
        resolve(event.target.result)
      };

      request.onerror = function(event) {
        reject(event);
        // if (request.error.name == "ConstraintError") {
        //   console.log("id already exists"); // handle the error
        //   event.preventDefault(); // don't abort the transaction
        //   event.stopPropagation(); // don't bubble error up, "chew" it
        // } else {
        //   // do nothing
        //   // transaction will be aborted
        //   // we can take care of error in transaction.onabort
        // }
      };

      // Event delegation
      // IndexedDB events bubble: request → transaction → database.
      // transaction.oncomplete = function() {
      //   console.log('add transaction complete'); 
      // };
      // transaction.onabort = function (evt) {
      //   console.error('add transaction onabort', evt);
      //   throw evt.target.error
      // }
    })
  }

  delete(id) {
    return new Promise((resolve, reject) => {
      const db = this.db;
      const tableName = this.tableName;
      const transaction = db.transaction(tableName, 'readwrite')
      const store = transaction.objectStore(tableName)
      const request = store.delete(id)

      request.onsuccess = function (evt) {
        console.log('delete onsuccess affect rows ', evt)
        resolve()
      }
      request.onerror = function (event) {
        console.error('delete onerror', event)
        reject(event)
      }

      // transaction.oncomplete = function() {
      //   console.log('delete transaction complete'); 
      // };
    })
  }

  put(data) {
    return new Promise((resolve, reject) => {
      const db = this.db;
      const tableName = this.tableName;
      const transaction = db.transaction(tableName, 'readwrite')
      const store = transaction.objectStore(tableName)

      const request = store.put(data);

      request.onsuccess = function (evt) {
        console.log('put onsuccess', evt)
        resolve(evt.target.result)
      }
      request.onerror = function (event) {
        console.error('put onerror', event)
        reject(event)
      }

      transaction.oncomplete = function() {
        console.log('put transaction complete'); 
      };
    })
  }

  bulkPut(datas) {
    if (!(datas && datas.length > 0)) {
      return Promise.reject(new Error('no data'))
    }
    return new Promise((resolve, reject) => {
      const db = this.db;
      const transaction = db.transaction('log', 'readwrite')
      const store = transaction.objectStore('log')

      datas.forEach(data => store.put(data))

      // Event delegation
      // IndexedDB events bubble: request → transaction → database.
      transaction.oncomplete = function() {
        console.log('add transaction complete'); 
        resolve()
      };
      transaction.onabort = function (evt) {
        console.error('add transaction onabort', evt);
        reject(evt.target.error)
      }
    })
  }

  getAll() {
    return new Promise((resolve, reject) => {
      const db = this.db;
      const tableName = this.tableName;
      const transaction = db.transaction(tableName, 'readonly')
      const store = transaction.objectStore(tableName)
      let request = store.openCursor()
      const result = []
      request.onsuccess = function (evt) {
        const cursor = evt.target.result
        if (cursor) {
          result.push(cursor.value)
          cursor.continue();
        } else {
          console.log('getAll success',  result)
          resolve(result)
        }
      }
      request.onerror = function (evt) {
        console.error('getAll onerror', evt)
        reject(evt.target.error)
      }

      transaction.onerror = function(evt) {
        reject(evt.target.error)
      };
    })
  }

  /**
   * 条件查询，带分页
   * 
   * @param {string} keyPath 索引名称
   * @param {string} keyRange 索引对象
   * @param {number} offset 分页偏移量
   * @param {number} limit 分页页码
   */
  getByIndex (keyPath, keyRange, offset = 0, limit = 100) {
    return new Promise((resolve, reject) => {
      const db = this.db;
      const transaction = db.transaction('log', 'readonly')
      const store = transaction.objectStore('log')
      const index = store.index(keyPath)
      let request = index.openCursor(keyRange)
      const result = []
      request.onsuccess = function (evt) {
        let cursor = evt.target.result
        // 偏移量大于 0，代表需要跳过一些记录
        if (offset > 0) {
          cursor.advance(offset);
        }
        if (cursor && limit > 0) {
          console.log(1)
          result.push(cursor.value)
          limit = limit - 1
          cursor.continue()
        } else {
          cursor = null
          resolve(result)
        }
      }
      request.onerror = function (evt) {
        console.err('getLogByIndex onerror', evt)
        reject(evt.target.error)
      }

      transaction.onerror = function(evt) {
        reject(evt.target.error)
      };
    })
  }

  get(indexName, value) {
    return new Promise((resolve, reject) => {
      const db = this.db;
      const tableName = this.tableName;
      const transaction = db.transaction(tableName, 'readwrite')
      const store = transaction.objectStore(tableName)
      let request
      // 有索引则打开索引来查找，无索引则当作主键查找
      if (indexName) {
        let index = store.index(indexName);
        request = index.get(value)
      } else {
        request = store.get(value)
      }

      request.onsuccess = function (evt) {
        if (evt.target.result) {
          console.log(`get ${indexName} ${value} onsuccess, get:`, evt.target.result)
          resolve(evt.target.result)
        } else {
          console.log('get onsuccess, no such log ', indexName, value)
          resolve(null)
        }
      }
      request.onerror = function (evt) {
        console.error('get onerror', evt, request.error)
        reject(evt)
      }
    });
  }
}



(async function() {
  const db = new Database({
    name: 'db_test',
    modelsOptions: {
      log: {
        keyPath: 'id',
        autoIncrement: true,
        rows: {
          id: 'number',
          time: 'number',
          body: 'string',
        },
        index: {
          time: 'time'
        }
      }
    }
  })
  await db.createDB()

  await db.models.log.add({time: new Date().getTime(), body: 'log 1' })
  
  await db.models.log.add({time: new Date().getTime(), body: 'log 2' })
  
  await db.models.log.get(null, 1)

  const time = new Date().getTime()

  await db.models.log.put({id: 1, time: time, body: 'log AAAA' })

  await db.models.log.add({time: new Date().getTime(), body: 'log 3' })

  await db.models.log.getAll()

  const test = await db.models.log.getByIndex('time', IDBKeyRange.lowerBound(time))
  // multi index query
  // await db.models.log.getByIndex('time, test_id', IDBKeyRange.bound([0, 99],[Date.now(), 2100]);)

  console.log(test)
})()