package com.ninejatruth.app.domain.repository

import com.ninejatruth.app.domain.model.Community
import com.ninejatruth.app.domain.model.Lga
import com.ninejatruth.app.domain.model.State
import com.ninejatruth.app.domain.model.Ward
import com.ninejatruth.app.domain.util.Result
import kotlinx.coroutines.flow.Flow

interface GeoRepository {
    fun getStates(): Flow<Result<List<State>>>
    fun getLgas(stateId: String): Flow<Result<List<Lga>>>
    fun getWards(lgaId: String): Flow<Result<List<Ward>>>
    fun getCommunities(wardId: String): Flow<Result<List<Community>>>
}
