import express from "express";
import path ,{dirname} from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import bodyParser from "body-parser";


const app = express();
const port = 3000;
const __dirname  = dirname(fileURLToPath(import.meta.url));
const url = 'https://jsearch.p.rapidapi.com/search';




app.use(express.json());
app.use(bodyParser.urlencoded({extended:true}));

//Serving static file from public
app.use(express.static(path.join(__dirname,"public")));


//Setting ejs as templating engine
app.set("view engine","ejs");
app.set("views",path.join(__dirname,"views"));






app.get("/",(req,res)=>{
    res.render("home");
})

app.get("/jobs",(req,res)=>{
    res.render("jobs");
})

app.post("/JobFilter",async (req,res)=>{
    console.log(req.body);
    const country = req.body.location;
    const employment_types = req.body["job-type"];
    const job_requirements = req.body.experience;
    const date_posted = req.body["date-posted"];
    
    
    const options = {
        method : "GET",
        url : "https://jsearch.p.rapidapi.com/search?query=developer%20jobs%20in%20chicago&page=9&num_pages=1&country=us&date_posted=all",
        headers: {
            'x-rapidapi-key': 'bb0107b96dmshf7bd3e5f6c352eep1d74d3jsne4823d785d8c',
            'x-rapidapi-host': 'jsearch.p.rapidapi.com'
        },     
    };

    try{
        const response = await axios.request(options);
        const data = response.data.data;
        const JobResults = data.slice(0, 9);
        console.log(JobResults)
        res.render("jobs",{jobs : JobResults});
    }
    catch(error){
        console.log("Error fetching data: ",error);
        res.render("jobs",{jobs : []});
    }
    console.log(country,employment_types);
})




app.listen(port,()=>{
    console.log(`Server running from ${port}`);
})
