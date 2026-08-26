const url = "https://co.wuk.sh/api/json"; // v7 endpoint on co.wuk.sh
const body = JSON.stringify({ url: "https://youtube.com/shorts/iplOcJz4T6k" });
fetch(url, {
  method: "POST",
  headers: {
    "Accept": "application/json",
    "Content-Type": "application/json"
  },
  body
})
.then(res => res.json())
.then(data => console.log(JSON.stringify(data, null, 2)))
.catch(err => console.error(err));
