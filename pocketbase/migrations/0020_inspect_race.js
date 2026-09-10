migrate(
  (app) => {
    // Read Race.tsx by chunks and store in pocketbase or a file
    const fs = require('fs')
    const content = fs.readFileSync('src/pages/Race.tsx', 'utf8')
    fs.writeFileSync('src/pages/race_size.txt', String(content.length), 'utf8')
  },
  () => {},
)
