migrate(
  (app) => {
    // Check $filesystem.fileFromBytes
    if (typeof $filesystem !== 'undefined' && typeof $filesystem.fileFromBytes === 'function') {
      const f = $filesystem.fileFromBytes('test', 'test.txt')
      console.log('fileFromBytes works:', f ? f.name : 'null')
    } else {
      console.log('fileFromBytes not available in migration')
    }
  },
  (app) => {},
)
