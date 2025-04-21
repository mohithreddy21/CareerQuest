import express from "express";
import path ,{dirname} from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import bodyParser from "body-parser";
import env from "dotenv";

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
    res.render("jobs",{
        jobs: [],
        currentPage: 1,
        totalPages: 1,
        filters: {
            location: "",
            "job-type": "",
            experience: "",
            "date-posted": "",
            salary: "",
        },
        totalJobs : ""
    });
})

app.get("/resumeBuilder",(req,res)=>{
    res.render("resume-builder");
})

app.get("/builder",(req,res)=>{
    res.render("builder");
})


// Job filter endpoint
app.post("/JobFilter", async (req, res) => {
    const jobsPerPage = 9;
    const currentPage = Number.parseInt(req.body.page) || 1;

    const start = (currentPage - 1) * jobsPerPage;
    const end = start + jobsPerPage;

    console.log("Received filter data:", req.body);

    const query = req.body.search || "developer jobs in Hyderabad"; // Default query with location
    const country = req.body.location || "in"; // Default to India
    const date_posted = req.body["date-posted"] || "all";
    const salary = req.body.salary;
    const experience = req.body.experience;
    const jobType = req.body["job-type"];

    let apiUrl = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&page=${currentPage}&num_pages=1&country=${country}&date_posted=${date_posted}`;

    let apiJobTypes;
    if (jobType && jobType !== "all") {
        const employmentTypesMap = {
            "full-time": "FULLTIME",
            "part-time": "PARTTIME",
            "internship": "INTERN",
        };
        apiJobTypes = Array.isArray(jobType)
            ? jobType.map(type => employmentTypesMap[type]).filter(Boolean).join(",")
            : employmentTypesMap[jobType];

        if (apiJobTypes) {
            apiUrl += `&employment_types=${encodeURIComponent(apiJobTypes)}`;
        }
    }

    let apiExperience;
    if (experience && experience !== "all") {
        const experienceMap = {
            "fresher": "no_experience",
            "0-1": "under_3_years_experience",
            "1-3": "under_3_years_experience",
            "3+": "more_than_3_years_experience",
        };
        apiExperience = experienceMap[experience];
        if (apiExperience) {
            apiUrl += `&job_requirements=${encodeURIComponent(apiExperience)}`;
        }
    }

    if (salary && salary !== "all") {
        const salaryKeywords = {
            "below-10k": "salary less than 10000",
            "10k-20k": "salary 10000 to 20000",
            "20k-40k": "salary 20000 to 40000",
            "above-40k": "salary more than 40000",
        };
        if (salaryKeywords[salary]) {
            apiUrl = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(`${query} ${salaryKeywords[salary]}`)}&page=${currentPage}&num_pages=1&country=${country}&date_posted=${date_posted}`;
            if (jobType && jobType !== "all" && apiJobTypes) {
                apiUrl += `&employment_types=${encodeURIComponent(apiJobTypes)}`;
            }
            if (experience && experience !== "all" && apiExperience) {
                apiUrl += `&job_requirements=${encodeURIComponent(apiExperience)}`;
            }
        }
    }

    const options = {
        method: "GET",
        url: apiUrl,
        headers: {
            "x-rapidapi-key": "bb0107b96dmshf7bd3e5f6c352eep1d74d3jsne4823d785d8c", // Replace with your actual API key
            "x-rapidapi-host": "jsearch.p.rapidapi.com",
        },
    };

    try {
        const response = await axios.request(options);
        const JobResults = response.data.data;

        console.log("API URL:", apiUrl);

        const jobsToDisplay = JobResults.slice(start, end);
        const totalPages = Math.ceil(JobResults.length / jobsPerPage);

        res.render("jobs", {
            jobs: jobsToDisplay,
            currentPage: currentPage,
            totalPages: totalPages,
            filters: {
                location: req.body.location || "",
                "job-type": req.body["job-type"] || "",
                experience: req.body.experience || "",
                "date-posted": req.body["date-posted"] || "",
                salary: req.body.salary || "",
            },
            totalJobs : JobResults.length
        });
    } catch (error) {
        console.error("Error fetching data:", error);
        res.render("jobs", {
            jobs: [],
            currentPage: 1,
            totalPages: 1,
            filters: {
                location: "",
                "job-type": "",
                experience: "",
                "date-posted": "",
                salary: "",
                totalJobs : 0
            },
        });
    }
});


app.get("/job-details/:job_id", async (req, res) => {
    const jobId = req.params.job_id;
    const options = {
        method: 'GET',
        url: 'https://jsearch.p.rapidapi.com/job-details', // Replace with the correct API endpoint
        params: { job_id: jobId },
        headers: {
            'x-rapidapi-key': 'bb0107b96dmshf7bd3e5f6c352eep1d74d3jsne4823d785d8c', // Replace with your actual API key
            'x-rapidapi-host': 'jsearch.p.rapidapi.com'
        }
    };

    try {
        const response = await axios.request(options);
        const jobDetails = response.data.data[0]; // Assuming the API returns an array with the details

        if (jobDetails) {
            res.render("job-details", { job: jobDetails });
        } else {
            res.render("error", { message: "Job details not found." }); // Handle case where job ID is invalid
        }
    } catch (error) {
        console.error("Error fetching job details:", error);
        res.render("error", { message: "Failed to fetch job details." });
    }
});


app.listen(port,()=>{
    console.log(`Server running from ${port}`);
})
