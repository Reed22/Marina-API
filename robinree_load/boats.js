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
function post_boat(name, type, length){
    var key = datastore.key([BOAT])
    const new_boat = {"name": name, "type": type, "length": length}
    return datastore.save({"key": key, "data": new_boat}).then(() => {return key})
  }

//Get boat with specific ID
function get_boat(id){
    var key = datastore.key([BOAT, parseInt(id, 10)]);
    return datastore.get(key)
    .then ((boats) => {
      return boats[0]
    })
}

//Assign load to a boat if load does not already have carrier
//Return -1 if boat of load id DNE. Return 1 if load has carrier. Return 0 if success
async function assign_load(boat_id, load_id){
    //need to add load_id and load_self to boat's "loads" property (array of objects)
    //need to add boat_id, boat name, and boat self to loads "carrier" prop (object)
    const boat_key = datastore.key([BOAT, parseInt(boat_id, 10)])
    const load_key = datastore.key([LOAD, parseInt(load_id, 10)])
    
    let boat = await datastore.get(boat_key)
    let load = await datastore.get(load_key)

    //If boat exists
    if(boat[0] && load[0]){
        //let load = await datastore.get(load_key)
        //If load exists
        //if(load[0]){
            //If load does not have carrier
            if(typeof(load[0].carrier) === 'undefined'){
                //If boat does not have any loads, initialize empty array
                if(!boat[0].loads)
                    boat[0].loads = []
    
                ds.fromDatastore(load[0])
                const load_info = {
                    "id": load[0].id,
                }
                boat[0].loads.push(load_info)
                const updated_boat = {
                    "name": boat[0].name,
                    "type": boat[0].type,
                    "length": boat[0].length,
                    "loads": boat[0].loads
                }
                //Update boat
                datastore.update({"key": boat_key, "data": updated_boat})
                ds.fromDatastore(boat[0])
                const new_carrier = {
                    "name": boat[0].name,
                    "id": boat[0].id
                }
                const updated_load = {
                    "weight": load[0].weight,
                    "content": load[0].content,
                    "delivery_date": load[0].delivery_date,
                    "carrier": new_carrier
                }
                datastore.update({"key": load_key, "data": updated_load})
                return 0
            }
            else return 1 //Load has carrier
        //}
        //else return -1 //Load DNE
    }
    else return -1 //BOAT DNE

}

//Remove load from a boat
//Return -1 if boat or load id DNE. Return 1 if load is not on boat. Return 0 if success
async function remove_load(boat_id, load_id){
    const boat_key = datastore.key([BOAT, parseInt(boat_id, 10)])
    const load_key = datastore.key([LOAD, parseInt(load_id, 10)])

    let boat = await datastore.get(boat_key)
    let load = await datastore.get(load_key)

    //If boat and load exists
    if(boat[0] && load[0]){
        //If specified boat is carrying specified load
        if(load[0].carrier && load[0].carrier.id === boat_id){
            const updated_load = {
                "weight": load[0].weight,
                "content": load[0].content,
                "delivery_date": load[0].delivery_date
                //"carrier": null
            }
            const filtered_loads = boat[0].loads.filter(this_load => this_load.id !== load_id)
            const updated_boat = {
                "name": boat[0].name,
                "type": boat[0].type,
                "length": boat[0].length,
            }
            if(filtered_loads.length > 0)
                updated_boat.loads = filtered_loads

            datastore.update({"key": boat_key, "data": updated_boat})
            datastore.update({"key": load_key, "data": updated_load})

            return 0 //Success
        }
        else return 1 //Boat is not carrying load
    }
    else return -1 //Boat or Load DNE
}

//Deletes boat and removes any loads
//Return 0 on success, -1 on failure
async function delete_boat(id){
    const boat_key = datastore.key([BOAT, parseInt(id, 10)])
    let [boat] = await datastore.get(boat_key)
    
    //If boat exists
    if(boat){
        //Boat has loads to remove
        if(boat.loads){
            //Go through each load and remove carrier attribute
            boat.loads.forEach(load => {
                let load_key = datastore.key([LOAD, parseInt(load.id, 10)])
                datastore.get(load_key)
                .then((this_load) => {
                    let updated_load = {
                        "weight": this_load[0].weight,
                        "content": this_load[0].content,
                        "delivery_date": this_load[0].delivery_date
                    }
                    datastore.update({"key": load_key, "data": updated_load})
                })
            })
        }
        datastore.delete(boat_key)
        return 0
    }
    return -1
}

//Gets load info for given boat. Return loads if successful, -1 if not
function get_boat_loads(id){
    const key = datastore.key([BOAT, parseInt(id,10)]);
    return datastore.get(key)
    .then( (boats) => {
        if(boats[0]){
            const boat = boats[0];
            const load_keys = boat.loads.map( (this_load) => {
                return datastore.key([LOAD, parseInt(this_load.id,10)]);
            });
            return datastore.get(load_keys);
        }
        else return -1
    })
    .then((loads) => {
        if(loads === -1) return -1
        loads = loads[0].map(ds.fromDatastore);
        return loads;
    });
}

//Get all boats, 3 per page
function get_boats(req){
    var q = datastore.createQuery(BOAT).limit(3);
    const results = {};
  
    if(Object.keys(req.query).includes("cursor")){
        q = q.start(req.query.cursor);
    }
    
    return datastore.runQuery(q).then( (entities) => {
      //results.items = entities[0].map(ds.fromDatastore);
      results.items = entities[0].map(ds.fromDatastore);
      results.items.forEach(item => {
          item.self = req.protocol + "://" + req.get("host") + "/boats/" + item.id
      })
      if(entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS ){
          results.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + entities[1].endCursor;
      }
      return results;
    })
  }
/****************************** ROUTES ******************************/

//Get all boats, 3 loads per page
router.get('/', function(req, res){
    get_boats(req)
    .then(loads => {
      res.status(200).send(loads)
    })
  });

//Create a boat
router.post('/', function(req, res){
    if(missingFields([req.body.name, req.body.type, req.body.length]))
      res.status(400).send({ "Error": "The request object is missing at least one of the required attributes" })
    else {
      post_boat(req.body.name, req.body.type, req.body.length)
      .then( key => {
            let self = req.protocol + "://" + req.get("host") + "/boats/" + key.id
            let return_object = {
              "id": key.id,
              "name": req.body.name,
              "type": req.body.type,
              "length": req.body.length,
              "self": self
            }
            res.status(201).send(return_object)
      })
    }
  });

//Get specific boat
router.get('/:boat_id', function(req, res){
    const boats = get_boat(req.params.boat_id)
                  .then( (boat) => {
                    if(boat){
                        boat.self = req.protocol + "://" + req.get("host") + "/boats/" + req.params.boat_id
                        //If boat has loads, add self link
                        if(boat.loads){
                            boat.loads.forEach(load => {
                                load.self = req.protocol + "://" + req.get("host") + "/loads/" + load.id
                            })
                        }
                        ds.fromDatastore(boat)
                        res.status(200).json(boat);
                    }
                    else {
                        let error = { "Error": "No boat with this boat_id exists" }
                        res.status(404).json(error)
                    }
                });
});

//Assign load to boat
router.put('/:boat_id/loads/:load_id', function(req,res){
    assign_load(req.params.boat_id, req.params.load_id)
    .then(outcome => {
        if(outcome === 0)
            res.status(204).end()
        else if(outcome === -1)
            res.status(404).send({"Error": "The specified boat and/or load does not exist"})
        else
            res.status(403).send({"Error": "Load already has a carrier"})
    })
});

//Remove Load
router.delete('/:boat_id/loads/:load_id', function(req, res){
    remove_load(req.params.boat_id, req.params.load_id)
    .then(outcome => {
        if(outcome === 0) 
            res.status(204).end()
        else if(outcome === 1)
            res.status(403).send({"Error": "Boat is not carrying this load"})
        else
            res.status(404).send({"Error": "No load with this load_id is on the boat with this boat_id"})
    })
})

//Delete Boat
router.delete('/:boat_id', function(req,res){
    delete_boat(req.params.boat_id)
    .then(outcome => {
        if(outcome === 0)
            res.status(204).end()
        else
            res.status(404).send({"Error": "No boat with this boat_id exists"})
    })
});

//Get all loads for given boat
router.get('/:boat_id/loads', function(req, res){
    const loads = get_boat_loads(req.params.boat_id)
	.then( (loads) => {
        if(loads === -1) 
            res.status(404).send({"Error": "No boat with this boat_id exists"})
        else {
            loads.forEach(load => {
                load.self = req.protocol + "://" + req.get("host") + "/loads/" + load.id
                load.carrier.self = req.protocol + "://" + req.get("host") + "/boats/" + req.params.boat_id
            })
            res.status(200).json(loads);
        }
    });
});

module.exports = router;
