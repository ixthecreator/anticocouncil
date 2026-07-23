package com.assembly.meeting.controller;

import com.assembly.meeting.model.Meeting;
import com.assembly.meeting.model.Issue;
import com.assembly.meeting.repository.MeetingRepository;
import com.assembly.meeting.repository.IssueRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/meetings")
@CrossOrigin(origins = "*")
public class MeetingController {

    private final MeetingRepository meetingRepository;
    private final IssueRepository issueRepository;

    @Autowired
    public MeetingController(MeetingRepository meetingRepository, IssueRepository issueRepository) {
        this.meetingRepository = meetingRepository;
        this.issueRepository = issueRepository;
    }

    @GetMapping
    public List<Meeting> getAllMeetings() {
        return meetingRepository.findAllByOrderByCreatedAtAsc();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Meeting> getMeetingById(@PathVariable String id) {
        Optional<Meeting> meeting = meetingRepository.findById(id);
        return meeting.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Meeting> createOrUpdateMeeting(@RequestBody Meeting meeting) {
        if (meeting.getId() == null || meeting.getId().trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        Meeting saved = meetingRepository.save(meeting);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Meeting> updateMeeting(@PathVariable String id, @RequestBody Meeting meetingDetails) {
        return meetingRepository.findById(id)
                .map(existingMeeting -> {
                    existingMeeting.setTitle(meetingDetails.getTitle());
                    existingMeeting.setWeek(meetingDetails.getWeek());
                    existingMeeting.setDate(meetingDetails.getDate());
                    existingMeeting.setSummary(meetingDetails.getSummary());
                    existingMeeting.setRegularReport(meetingDetails.getRegularReport());
                    existingMeeting.setIssueIds(meetingDetails.getIssueIds());
                    Meeting updated = meetingRepository.save(existingMeeting);
                    return ResponseEntity.ok(updated);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMeeting(@PathVariable String id) {
        if (!meetingRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        
        // Cascading: Unbind any issues associated with this deleted meeting
        List<Issue> associatedIssues = issueRepository.findByMeetingId(id);
        for (Issue issue : associatedIssues) {
            issue.setMeetingId(null);
            issueRepository.save(issue);
        }

        meetingRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
