# indexeddb-test

IndexedDB 实战-IndexedDB 代码封装、性能摸索以及多标签支持

当一个 Javascript 程序需要在浏览器端存储数据时，你有几个选择

* Cookie，通常用于 HTTP 请求，并且有 64 kb 的大小限制。
* LocalStorage，存储 key-value 格式的键值对，通常有 5MB 的限制。
* WebSQL，并不是 HTML5 标准，已被废弃
* FileSystem & FileWriter API，兼容性极差，目前只有 Chrome 浏览器支持
* IndexedDB，是一个 NOSQL 数据库，异步操作，支持事务，可存储 JSON 数据并且用索引迭代，兼容性好。

很明显，只有 IndexedDB 适用于做大量的数据存储。但是直接使用 IndexedDB 会碰到几个问题：

* IndexedDB API 基于事务，偏向底层，操作繁琐，需要简化封装。
* IndexedDB 性能瓶颈。
* IndexedDB 在 浏览器多 tab 页的情况下可能会对同一条数据记录进行多次操作。

本仓库作为示例代码使用

