package com.ninejatruth.app.domain.repository

import com.ninejatruth.app.domain.model.Candidate
import com.ninejatruth.app.domain.model.Election
import com.ninejatruth.app.domain.model.Office
import com.ninejatruth.app.domain.model.Party
import com.ninejatruth.app.domain.util.Result
import kotlinx.coroutines.flow.Flow

interface PoliticsRepository {
    fun getParties(page: Int): Flow<Result<List<Party>>>
    fun getParty(partyId: String): Flow<Result<Party>>
    fun getCandidates(
        page: Int,
        partyId: String?,
        officeId: String?,
        stateId: String?
    ): Flow<Result<List<Candidate>>>
    fun getCandidate(candidateId: String): Flow<Result<Candidate>>
    fun getOffices(): Flow<Result<List<Office>>>
    fun getElections(status: String?, stateId: String?): Flow<Result<List<Election>>>
    fun getElection(electionId: String): Flow<Result<Election>>
}
