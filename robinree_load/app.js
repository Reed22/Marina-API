
//Get all boats
function get_boats(){
	const q = datastore.createQuery(BOAT);
	return datastore.runQuery(q).then( (entities) => {
      let boats = entities[0].map(fromDatastore)
			return entities[0].map(fromDatastore);
		});
}

//Update boat properties
async function patch_boat(id, name, type, length){
  let error = false 
  const key = datastore.key([BOAT, parseInt(id,10)]);
  const boat = {"name": name, "type": type, "price": length};

  await datastore.update({"key": key, "data": boat}).catch((err) => {
    if(err)
      error = true
  })
  return error
 
}

//Create slip
function post_slip(number){
  var key = datastore.key([SLIP])
  const new_slip = {"number": number, "current_boat": null}
  return datastore.save({"key": key, "data": new_slip}).then(() => {return key})
}

//Get all slips
function get_slips(){
  const q = datastore.createQuery(SLIP);
	return datastore.runQuery(q).then( (entities) => {
      let slips = entities[0].map(fromDatastore)
			return entities[0].map(fromDatastore);
	});
}

//Put boat id into slip's current_boat
async function put_slip(slip_id, boat_id){
  const slip_key = datastore.key([SLIP, parseInt(slip_id,10)]);
  const boat_key = datastore.key([BOAT, parseInt(boat_id,10)]);
  let [entity] = await datastore.get(boat_key);   //If get successfull, entity will hold boat, null if boat does not exist
  let error = 0 //0 is success, -1 is boat/slip id does not exist, 1 if slip is taken

  //If boat exists
  if(entity){
    [entity] = await datastore.get(slip_key)

    //If slip does not exist
    if(!entity){
      error = -1
    }

    else{
      //If slip is unavailable
      if(entity.current_boat){
        error = 1
      }
      //Update slip
      else {
        const slip = {"current_boat": boat_id, "number": entity.number};
        await datastore.update({"key": slip_key, "data": slip}).catch((err) => {
          //If slip does not exist
          if(err)
            error = -1
        });
      }
    }
  }

  else {
    error = -1
  }
  return error
}

//Check if slip and boat exist, then set slip's current boat to null
async function boat_depart_ship(slip_id, boat_id){
  const slip_key = datastore.key([SLIP, parseInt(slip_id,10)]);
  const boat_key = datastore.key([BOAT, parseInt(boat_id,10)]);
  let [entity] = await datastore.get(boat_key);

  //Boat exists
  if(entity){
    [entity] = await datastore.get(slip_key);

    //Slip Exists
    if(entity){

      //If boat with boat_id has slip with slip_id
      if(entity.current_boat === boat_id){
        const slip = {"current_boat": null, "number": entity.number};
        await datastore.update({"key": slip_key, "data": slip})
        return true
      }
    }
  }
  return false  //Unsuccessful: Either boat or slip does not exist
}

//Grab slips, check for id in slips current_boat, if id present, set to null and delete boat
//Return true if successful, false if not
async function delete_boat(boat_id){
  const boat_key = datastore.key([BOAT, parseInt(boat_id,10)]);
  let [entity] = await datastore.get(boat_key);
  const slips = await get_slips()
  //Boat exists
  if(entity){
    //Find slip that boat occupies, if any    
    let this_slip = {}
    for(let i = 0; i < slips.length; i++){
      if(boat_key.id == slips[i].current_boat){
        this_slip = slips[i]
      }
    }
    
    //Slip exists
    if(Object.keys(this_slip).length != 0){
      const slip_key = datastore.key([SLIP, parseInt(this_slip.id,10)]);

      const slip = {
        "number": this_slip.number,
        "current_boat": null
      }
      await datastore.update({"key": slip_key, "data": slip})
    }

    datastore.delete(boat_key);

    return true
  }
  else
    return false
}

//Check that slip exists, then delete if it does. Return -1 if slip does not exist, 1 if successful
async function delete_slip(slip_id){
  const key = datastore.key([SLIP, parseInt(slip_id,10)]);
  let error = 1
  let variable = await datastore.get(key); //array returned by datastore.get --> will contain null or slip
  
  //If slip does not exist
  if(!variable[0])
    error = -1
  else
    datastore.delete(key)

  return error
}
/****************** END DATABASE FUNCTIONS ********************************/

/*************************** START ROUTES *********************************/


//Get specific boat
app.get('/boats/:boat_id', function(req, res){
    const boats = get_boats()
                  .then( (boats) => {
                    let this_boat = boats.filter(boat => req.params.boat_id === boat.id)
                    if(this_boat.length === 1){
                      this_boat[0].self = URL + "/boats/" + req.params.boat_id
                      res.status(200).json(this_boat[0]);
                    }
                    else {
                      let error = { "Error": "No boat with this boat_id exists" }
                      res.status(404).json(error)
                    }
  });
});

//Get all boats
app.get('/boats', function(req, res){
  const boats = get_boats()
                .then( (boats) => {
                    boats.forEach(boat => {
                      boat.self = URL + "/boats/" + boat.id
                    })
                    res.status(200).json(boats);

  });
});

app.patch('/boats/:boat_id', function(req, res){
  //If request is missing fields
  if(missingFields([req.body.name, req.body.type, req.body.length]))
    res.status(400).send({ "Error": "The request object is missing at least one of the required attributes" })

  else {
    patch_boat(req.params.boat_id, req.body.name, req.body.type, req.body.length).then((error) => {
      //If error flag from patch_boat() set
      if(error){
        res.status(404).send({"Error": "No boat with this boat_id exists"})
      }
      else {
        let return_obj = {
          "id": req.params.boat_id,
          "name": req.body.name,
          "type": req.body.type,
          "length": req.body.length,
          "self": URL + '/boats/' + req.params.boat_id
        }
        res.status(200).send(return_obj)
      }
    })
  }
});

app.get('/slips/:slip_id', function(req, res){
  const boats = get_slips()
                .then( (slips) => {
                  let this_slip = slips.filter(slip => req.params.slip_id === slip.id)
                  if(this_slip.length === 1){
                    this_slip[0].self = URL + "/slips/" + req.params.slip_id
                    res.status(200).json(this_slip[0]);
                  }
                  else {
                    let error = { "Error": "No slip with this slip_id exists" }
                    res.status(404).json(error)
                  }
  });
});

app.get('/slips', function(req, res){
  const slips = get_slips()
                .then( (slips) => {
                  slips.forEach(slip => {
                    slip.self = URL + "/slips/" + slip.id
                    })
                    res.status(200).json(slips);

  });
});

app.put('/slips/:slip_id/:boat_id', function(req, res){
    //Put boat_id into current_boat of slip with slip_id
    put_slip(req.params.slip_id, req.params.boat_id).then((success) =>{
      if(success === 0)
        res.status(204).end()
      else if(success === -1)
        res.status(404).send({"Error": "The specified boat and/or slip does not exist"})
      else
        res.status(403).send({"Error": "The slip is not empty"})
    })
});

app.delete('/slips/:slip_id/:boat_id', function(req, res){
  boat_depart_ship(req.params.slip_id, req.params.boat_id).then( results => {
    if(results)
      res.status(204).end();
    else
      res.status(404).send({"Error": "No boat with this boat_id is at the slip with this slip_id"})
  });
});

app.delete('/boats/:boat_id', async function(req, res){
  let success = await delete_boat(req.params.boat_id)
  if(success)
    res.status(204).end()
  else 
    res.status(404).send({"Error": "No boat with this boat_id exists"})

});

app.delete('/slips/:slip_id', async function(req, res){
    let success = await delete_slip(req.params.slip_id)
    if(success != -1)
      res.status(204).end()
    else
      res.status(404).send({"Error": "No slip with this slip_id exists"})
})

