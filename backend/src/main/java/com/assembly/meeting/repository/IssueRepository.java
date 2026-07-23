package com.assembly.meeting.repository;

import com.assembly.meeting.model.Issue;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IssueRepository extends JpaRepository<Issue, String> {
    List<Issue> findByMeetingId(String meetingId);
    List<Issue> findByMeetingIdAndArchived(String meetingId, boolean archived);
}
