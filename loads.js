const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('./datastore');

const datastore = ds.datastore;

const BOAT = "Boat";
const LOAD = "LOAD";
//const URL = "http://localhost:8080";

router.use(bodyParser.json());

/************************* HELPER FUNCTIONS *************************/

//Returns true if any of the fields passed in are undefined
function missingFields(fields){
    let isMissing = false
    fields.forEach(field => {
      if(!field){
        isMissing = true
      }
    })
    return isMissing
  }
//Create boat
function post_load(weight, content, delivery_date){
    var key = datastore.key([LOAD])
    const new_load = {"weight": weight, "content": content, "delivery_date": delivery_date}
    return datastore.save({"key": key, "data": new_load}).then(() => {return key})
  }

//Get specific load
function get_load(id){
    var key = datastore.key([LOAD, parseInt(id, 10)]);
    return datastore.get(key)
    .then ((loads) => {
      const load = loads[0];
      return load
    })
}

//Delete load
async function delete_load(id){
  const load_key = datastore.key([LOAD, parseInt(id, 10)]);
  const [load] = await datastore.get(load_key)

  if(!load)
      return -1

  //If load has a carrier, get ID, lookup boat, and update boat load
  if(load.carrier){
      const boat_id = load.carrier.id
      const boat_key = datastore.key([BOAT, parseInt(boat_id, 10)]);
      const [boat] = await datastore.get(boat_key)
      ds.fromDatastore(load)
      const filtered_loads = boat.loads.filter(this_load => this_load.id !== load.id)

      let updated_boat = {
        "name": boat.name,
        "type": boat.type,
        "length": boat.length
      }
      //Add loads attribute if there are any loads in the array
      if(filtered_loads.length > 0){
        updated_boat.loads = filtered_loads
      }
      datastore.update({"key": boat_key, "data": updated_boat})
    }
  datastore.delete(load_key)
  return 0
}

//Get all loads, 3 per page
function get_loads(req){
  var q = datastore.createQuery(LOAD).limit(3);
  const results = {};

  if(Object.keys(req.query).includes("cursor")){
      q = q.start(req.query.cursor);
  }
  
  return datastore.runQuery(q).then( (entities) => {
    //results.items = entities[0].map(ds.fromDatastore);
    results.items = entities[0].map(ds.fromDatastore);
    results.items.forEach(item => {
      item.self = req.protocol + "://" + req.get("host") + "/loads/" + item.id
  })
    if(entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS ){
        results.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + encodeURIComponent(entities[1].endCursor);
    }
    return results;
  })
}

/****************************** ROUTES ******************************/

//Get all loads, 3 loads per page
router.get('/', function(req, res){
  get_loads(req)
  .then(loads => {
    res.status(200).send(loads)
  })
});

//Create a boat
router.post('/', function(req, res){
    if(missingFields([req.body.weight, req.body.content, req.body.delivery_date]))
      res.status(400).send({ "Error": "The request object is missing at least one of the required attributes" })
    else {
      post_load(req.body.weight, req.body.content, req.body.delivery_date)
      .then( key => {
            let self = req.protocol + "://" + req.get("host") + "/loads/" + key.id
            let return_object = {
              "id": key.id,
              "weight": req.body.weight,
              "content": req.body.content,
              "delivery_date": req.body.delivery_date,
              "self": self
            }
            res.status(201).send(return_object)
      })
    }
  });

router.get('/:load_id', function(req, res){
  const boats = get_load(req.params.load_id)
                .then( (load) => {
                  if(load){
                    load.self = req.protocol + "://" + req.get("host") + "/loads/" + req.params.load_id
                    ds.fromDatastore(load)
                    
                    if(typeof(load.carrier) !== 'undefined'){
                      //console.log(typeof(load.carrier))
                      load.carrier.self = req.protocol + "://" + req.get("host") + "/boats/" + load.carrier.id
                    }
                    res.status(200).json(load);
                  }
                  else {
                    let error = { "Error": "No load with this load_id exists" }
                    res.status(404).json(error)
                  }
  });
});

router.delete('/:load_id', function(req,res){
    delete_load(req.params.load_id)
    .then(outcome => {
      if(outcome === 0)
        res.status(204).end()
      else
        res.status(404).send({"Error": "No load with this load_id exists"})
    })
});
module.exports = router;
